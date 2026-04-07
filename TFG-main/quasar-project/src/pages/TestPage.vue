<template>
  <q-page class="flex flex-center" padding>
    <!-- Estado de Carga -->
    <div v-if="loading" class="text-center">
      <q-spinner-dots color="primary" size="40px" />
      <div class="q-mt-md text-grey-8">Cargando preguntas...</div>
    </div>
    
    <!-- Estado de Error -->
    <div v-else-if="error" class="text-center">
        <q-icon name="error_outline" color="negative" size="50px" />
        <div class="q-mt-md text-h6">{{ errorMessage }}</div>
        <q-btn label="Volver" color="primary" :to="redirectPath" class="q-mt-md" unelevated rounded />
    </div>

    <!-- Contenido del Test -->
    <q-card v-else-if="questions.length > 0" style="width: 800px; max-width: 90vw;">
      <q-card-section>
        <div class="text-h5 text-center q-mb-md">Evaluando Historia #{{ route.params.id }}</div>
        <div v-if="isRepeatMode" class="text-subtitle1 text-center text-secondary q-mb-md">(Modo Repaso: Falladas y Pendientes)</div>
        <q-linear-progress :value="progress" color="primary" size="10px" rounded />
        <div class="text-right q-mt-sm text-grey-8">Pregunta {{ currentQuestionIndex + 1 }} de {{ questions.length }}</div>
      </q-card-section>

      <q-separator />

      <!-- Vista de la Pregunta y Feedback -->
      <q-card-section v-if="!testFinished">
        <div class="text-h6 q-mb-lg">{{ currentQuestion.text }}</div>
        
        <div class="q-gutter-y-sm">
            <q-item v-for="(option, index) in currentQuestion.options" :key="index" tag="label" v-ripple :class="getOptionClass(option.value)" class="rounded-borders q-pa-md">
                <q-item-section avatar><q-radio v-model="selectedOption" :val="option.value" :disable="showFeedback"/></q-item-section>
                <q-item-section><q-item-label>{{ option.label }}</q-item-label></q-item-section>
            </q-item>
        </div>

        <q-slide-transition>
            <div v-if="showFeedback">
                <q-card flat bordered class="q-mt-lg">
                    <q-card-section>
                        <div class="text-weight-bold">Explicación:</div>
                        <div>{{ lastExplanation }}</div>
                    </q-card-section>
                </q-card>
            </div>
        </q-slide-transition>
      </q-card-section>
      
      <!-- Vista de Resultados Finales -->
      <q-card-section v-else class="text-center">
        <q-icon name="check_circle" color="positive" size="100px" />
        <div class="text-h4 q-mt-md">¡Test finalizado!</div>
        <div class="q-mt-md q-gutter-y-sm text-subtitle1">
          <div>Has respondido <strong>{{ userAnswers.length }}</strong> preguntas.</div>
          <div class="text-positive">Aciertos: <strong>{{ score }}</strong></div>
          <div class="text-negative">Fallos: <strong>{{ incorrectAnswers }}</strong></div>
        </div>
        <div v-if="isSaving" class="q-mt-md">
            <q-spinner-dots color="primary" size="20px" /> Guardando resultado...
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions class="q-pa-md">
        <q-btn v-if="!testFinished" label="Terminar Test" color="grey" flat rounded @click="finishTest(true)" class="q-mr-auto" />
        <q-btn v-if="!showFeedback && !testFinished" label="Comprobar" color="primary" unelevated rounded @click="checkAnswer" :disable="selectedOption === null" />
        <q-btn v-if="showFeedback && !testFinished" :label="isLastQuestion ? 'Ver Resultados' : 'Continuar'" color="secondary" unelevated rounded @click="proceedToNextStep" />
        <q-btn v-else-if="testFinished" :label="`Volver a ${topicName}`" color="primary" flat rounded @click="navigateToTopic" />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'

export default defineComponent({
  name: 'TestPage',
  setup () {
    const route = useRoute();
    const $q = useQuasar();

    const questions = ref([]);
    const loading = ref(true);
    const error = ref(false);
    const errorMessage = ref('');
    const isSaving = ref(false);
    const currentQuestionIndex = ref(0);
    const selectedOption = ref(null);
    const userAnswers = ref([]);
    const testFinished = ref(false);
    const showFeedback = ref(false);
    const lastExplanation = ref('');
    const finishedManually = ref(false);
    
    // --- Computed Properties ---
    const isRepeatMode = computed(() => route.query.modo === 'repetir');
    const score = computed(() => userAnswers.value.filter(a => a.esCorrecta).length);
    const incorrectAnswers = computed(() => userAnswers.value.length - score.value);
    const currentQuestion = computed(() => questions.value[currentQuestionIndex.value]);
    const progress = computed(() => questions.value.length ? (currentQuestionIndex.value + 1) / questions.value.length : 0);
    const isLastQuestion = computed(() => currentQuestionIndex.value === questions.value.length - 1);
    
    // --- Dynamic Redirection Logic ---
    const getRedirectInfo = (id) => {
        const numId = parseInt(id, 10);
        if (numId >= 1 && numId <= 1) return { path: '#/fundamentos', name: 'Fundamentos' };
        if (numId >= 2 && numId <= 6) return { path: '#/conceptual', name: 'Diseño Conceptual' };
        if (numId >= 7 && numId <= 9) return { path: '#/logico', name: 'Diseño Lógico' };
        if (numId >= 10 && numId <= 16) return { path: '#/ddl', name: 'DDL' };
        if (numId >= 17 && numId <= 21) return { path: '#/dml', name: 'DML' };
        return { path: '#/', name: 'Inicio' };
    };
    const redirectInfo = computed(() => getRedirectInfo(route.params.id));
    const redirectPath = computed(() => redirectInfo.value.path);
    const topicName = computed(() => redirectInfo.value.name);

    // --- FUNCIÓN DE RESETEO (NUEVA) ---
    const resetStateAndFetch = () => {
        questions.value = [];
        loading.value = true;
        error.value = false;
        errorMessage.value = '';
        isSaving.value = false;
        currentQuestionIndex.value = 0;
        selectedOption.value = null;
        userAnswers.value = [];
        testFinished.value = false;
        showFeedback.value = false;
        lastExplanation.value = '';
        finishedManually.value = false;
        fetchQuestions();
    }

    // --- API Logic ---
    const fetchQuestions = async () => {
      loading.value = true;
      error.value = false;
      try {
        const historiaId = route.params.id;
        const url = `/api/historias/${historiaId}/preguntas`;
        
        const config = { params: {} };
        if (route.query.modo === 'repetir') {
          config.params.modo = 'repetir';
        }

        const response = await api.get(url, config);
        if (response.data && response.data.length > 0) {
            questions.value = response.data;
        } else {
            error.value = true;
            errorMessage.value = 'No se encontraron preguntas para este modo.';
        }
      } catch (err) {
        console.error("Error al cargar las preguntas:", err);
        error.value = true;
        errorMessage.value = err.response?.data?.message || 'No se pudo conectar con el servidor.';
        $q.notify({ type: 'negative', message: errorMessage.value });
      } finally {
        loading.value = false;
      }
    };
    
    const submitTestResults = async () => {
        isSaving.value = true;
        try {
            const payload = {
                usuarioCorreo: 'usuario@ejemplo.com',
                calificacion: (score.value / userAnswers.value.length) * 100, // Calificación sobre respondidas
                respuestas: userAnswers.value
            };
            await api.post('/api/intentos', payload);
            $q.notify({ type: 'positive', message: 'Resultados guardados correctamente.' });
        } catch (err) {
            console.error("Error al guardar el intento:", err);
            $q.notify({ type: 'negative', message: 'No se pudo guardar el resultado.' });
        } finally {
            isSaving.value = false;
        }
    };
    
    // --- Test Flow Logic ---
    const checkAnswer = () => {
      if (selectedOption.value === null) return;
      const isCorrect = selectedOption.value === currentQuestion.value.correctAnswer;
      userAnswers.value.push({
          preguntaId: currentQuestion.value.id,
          opcionTexto: selectedOption.value,
          esCorrecta: isCorrect
      });
      lastExplanation.value = currentQuestion.value.explicacion || 'No hay una explicación detallada para esta pregunta.';
      showFeedback.value = true;
    };
    
    const finishTest = (manual = false) => {
        finishedManually.value = manual;
        testFinished.value = true;
        if (userAnswers.value.length > 0) {
            submitTestResults();
        }
    };

    const proceedToNextStep = () => {
      if (isLastQuestion.value) {
        finishTest(false);
      } else {
        showFeedback.value = false;
        currentQuestionIndex.value++;
        selectedOption.value = null;
      }
    };
    
    const navigateToTopic = () => {
      window.location.href = `${window.location.origin}/${redirectPath.value}`;
    };
    
    const getOptionClass = (optionValue) => {
        if (!showFeedback.value) return '';
        const isCorrect = optionValue === currentQuestion.value.correctAnswer;
        const isSelected = optionValue === selectedOption.value;
        if (isCorrect) return 'bg-green-2 text-black';
        if (isSelected && !isCorrect) return 'bg-red-2 text-black';
        return '';
    };

    // --- Lifecycle and Watcher Hooks ---
    watch(() => route.fullPath, (newPath, oldPath) => {
        if (newPath !== oldPath) {
            resetStateAndFetch();
        }
    });

    onMounted(resetStateAndFetch);

    return {
      route,
      questions,
      loading,
      error,
      errorMessage,
      isSaving,
      currentQuestionIndex,
      currentQuestion,
      selectedOption,
      score,
      incorrectAnswers,
      testFinished,
      progress,
      isLastQuestion,
      showFeedback,
      lastExplanation,
      finishedManually,
      isRepeatMode,
      redirectPath,
      topicName,
      checkAnswer,
      proceedToNextStep,
      getOptionClass,
      finishTest,
      navigateToTopic,
      userAnswers
    };
  }
});
</script>
