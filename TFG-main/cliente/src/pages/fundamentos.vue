<template>
  <q-page padding>
    <!-- Cabecera -->
    <div class="q-mb-lg">
      <div class="header-title">Fundamentos</div>
      <div class="header-subtitle">Selecciona una historia para evaluar o gestionar.</div>
    </div>

    <!-- Estado de Carga y Error -->
    <div v-if="loading" class="text-center q-mt-xl">
      <q-spinner-dots color="primary" size="40px" />
      <div class="q-mt-md text-grey-8">Cargando historias de Fundamentos de las bases de datos...</div>
    </div>
    <div v-else-if="error" class="text-center q-mt-xl">
      <q-icon name="error_outline" color="negative" size="50px" />
      <div class="q-mt-md text-h6">No se pudieron cargar las historias.</div>
      <q-btn label="Intentar de nuevo" color="primary" @click="fetchAllData" class="q-mt-md" unelevated rounded />
    </div>

    <div v-else>
      <!-- SECCIÓN DE ESTADÍSTICAS GLOBALES -->
      <div class="row q-col-gutter-lg q-mb-xl">
        <div class="col-12 col-md-5">
          <q-card class="stat-card full-height">
            <q-card-section>
              <div class="text-h6 text-grey-8">Progreso de Historias</div>
            </q-card-section>
            <q-card-section class="flex flex-center">
                <div class="donut-container-large">
                    <Doughnut v-if="stats.storiesChartData.length" :data="{
                        labels: ['Superadas', 'No Superadas', 'Pendientes'],
                        datasets: [{ data: stats.storiesChartData, backgroundColor: ['#21BA45', '#DB2828', '#CCCCCC'] }]
                    }" :options="{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }" />
                </div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-7">
          <q-card class="stat-card full-height">
            <q-card-section>
              <div class="text-h6 text-grey-8">Progreso de Preguntas</div>
              <div class="text-caption text-grey">
                Has respondido {{ stats.totalPreguntas - stats.preguntasPendientes }} de {{ stats.totalPreguntas }} preguntas.
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none flex flex-center" style="height: calc(100% - 70px);">
                <div class="full-width">
                    <div class="text-center q-mb-md">
                        <span class="text-h3 text-weight-bolder">{{ 100 - stats.porcentajePendientes }}</span>
                        <span class="text-h5 text-grey-7">%</span>
                        <div class="text-overline">Completado</div>
                    </div>
                     <q-linear-progress :value="(100 - stats.porcentajePendientes) / 100" size="25px" rounded color="primary">
                        <div class="absolute-full flex flex-center">
                            <q-badge v-if="stats.porcentajePendientes < 100" color="white" text-color="primary" :label="`Quedan ${stats.preguntasPendientes} pendientes`" />
                             <q-badge v-else color="white" text-color="primary" label="¡Completado!" />
                        </div>
                    </q-linear-progress>
                </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Lista de Historias -->
      <div class="q-gutter-y-md">
        <q-expansion-item
          v-for="historia in historias"
          :key="historia.id"
          class="history-card"
          header-class="history-card-header"
          @before-show="fetchStoryStats(historia)"
        >
          <template v-slot:header>
            <q-item-section>
              <div class="text-h6">{{ historia.titulo }}</div>
            </q-item-section>
            <q-item-section side>
              <div class="row items-center q-gutter-x-md">
                <div :class="`status-badge status-${historia.estado.toLowerCase().replace(' ', '_')}`">{{ historia.estado }}</div>
                <!-- BOTONES MODIFICADOS: ya no tienen la propiedad ':disable' -->
                <q-btn color="primary" unelevated rounded label="Evaluar Historia" @click.stop="evaluarHistoria(historia.id)" />
                <q-btn outline rounded color="secondary" label="Repetir Falladas" @click.stop="repetirPreguntas(historia.id)" />
              </div>
            </q-item-section>
          </template>

          <q-card>
            <q-card-section>
              <div v-if="historia.statsLoading" class="text-center q-pa-md">
                <q-spinner-dots color="primary" size="30px" />
              </div>
              <div v-else-if="historia.stats" class="row q-col-gutter-md q-mb-md">
                <div class="col-12 col-md-8">
                  <q-list bordered separator>
                    <q-item-label header>Criterios de Aceptación</q-item-label>
                    <q-item v-for="criterio in historia.criterios" :key="criterio.id">
                      <q-item-section>{{ criterio.texto }}</q-item-section>
                      <q-item-section side>
                        <q-icon v-if="criterio.estado === 'Superado'" name="check_circle" color="positive" />
                        <q-icon v-else-if="criterio.estado === 'No Superado'" name="cancel" color="negative" />
                        <q-icon v-else name="help_outline" color="grey" />
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
                <div class="col-12 col-md-4 column items-center justify-center q-gutter-y-lg">
                  <div class="donut-container-small q-mb-lg">
                  <div class="text-subtitle2 text-grey-8 q-mb-mb q-mt-sm text-center">
                    Progreso de Criterios
                  </div>
                  <Doughnut :data="{
                    labels: ['Superados', 'No Superados', 'Pendientes'],
                    datasets: [{ data: historia.criteriaDonutData, backgroundColor: ['#21BA45', '#DB2828', '#CCCCCC'] }]
                  }" :options="{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }" />
                </div>
                <div class="full-width q-mb-mb">
                  <div class="text-subtitle2 text-grey-8 q-mb-mb text-center">Progreso de Preguntas</div>
                  <q-linear-progress :value="historia.stats.progress / 100" size="20px" rounded color="primary" class="q-mb-xs" />
                  <div class="text-caption text-grey text-right">
                    {{ historia.stats.preguntasRespondidas }} / {{ historia.stats.totalPreguntas }} ({{ historia.stats.progress }}%)
                  </div>
                </div>
                  <q-btn color="deep-purple" glossy label="Solicitar más preguntas" @click="solicitarMasPreguntas(historia)" :loading="generatingFor === historia.id" :disable="generatingFor !== null">
                    <template v-slot:loading><q-spinner-dots /></template>
                  </q-btn>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, ArcElement)

const GENERATING_STORY_KEY = 'generating_story_id'

export default defineComponent({
  name: 'FundamentosPage',
  components: { Doughnut },
  setup() {
    const router = useRouter()
    const $q = useQuasar()
    const loading = ref(true)
    const error = ref(false)
    const historias = ref([])
    const objetivoId = 1
    const generatingFor = ref(null) 
    
    let pollingInterval = null
    let dismissGeneratingNotification = null

    const stats = ref({
      storiesChartData: [],
      totalPreguntas: 0,
      preguntasPendientes: 0,
      porcentajePendientes: 0
    })

    const showGeneratingNotification = () => {
      if (dismissGeneratingNotification) return
      dismissGeneratingNotification = $q.notify({
        spinner: true, message: 'Generando preguntas...', color: 'info', position: 'bottom-right', timeout: 0, actions: [{ icon: 'close', color: 'white' }]
      })
    }

    // Limpia todo el estado de generación, incluyendo localStorage
    const clearGeneratingState = () => {
      if (pollingInterval) clearInterval(pollingInterval)
      pollingInterval = null
      if (dismissGeneratingNotification) dismissGeneratingNotification()
      dismissGeneratingNotification = null
      generatingFor.value = null
      localStorage.removeItem(GENERATING_STORY_KEY)
    }

    const startPolling = (historiaId) => {
      if (pollingInterval) clearInterval(pollingInterval)

      pollingInterval = setInterval(async () => {
        try {
          const response = await api.get(`/api/historias/${historiaId}/estado-generacion`)
          const status = response.data.status

          if (status === 'COMPLETADO' || status === 'ERROR' || status === 'INACTIVO') {
            if (status === 'COMPLETADO') {
              $q.notify({ type: 'positive', message: 'Preguntas generadas con éxito.', position: 'bottom-right' })
            } else if (status === 'ERROR') {
              $q.notify({ type: 'negative', message: 'La generación falló en el servidor.' })
            }
            clearGeneratingState()
            await fetchAllData()
          }
        } catch (err) {
          $q.notify({ type: 'negative', message: 'Error al comprobar el estado.' })
          clearGeneratingState()
        }
      }, 5000)
    }

    const calculateStoryStats = () => {
        const superadas = historias.value.filter(h => h.estado === 'Superado').length
        const noSuperadas = historias.value.filter(h => h.estado === 'No Superado').length
        const pendientes = historias.value.length - (superadas + noSuperadas)
        stats.value.storiesChartData = [superadas, noSuperadas, pendientes]
    }

    const fetchHistorias = async () => {
      const response = await api.get(`/api/objetivos/${objetivoId}/historias`)
      historias.value = response.data.map(h => {
        const superados = h.criterios.filter(c => c.estado === 'Superado').length;
        const noSuperados = h.criterios.filter(c => c.estado === 'No Superado').length;
        const pendientes = h.criterios.length - (superados + noSuperados);
        return {
          ...h,
          expanded: false,
          stats: null,
          statsLoading: false,
          criteriaDonutData: [superados, noSuperados, pendientes]
        }
      })
      calculateStoryStats()
    }

    const fetchStats = async () => {
        const response = await api.get(`/api/objetivos/${objetivoId}/stats`)
        const data = response.data
        stats.value.totalPreguntas = data.totalPreguntas
        const pendientes = data.totalPreguntas - data.preguntasRespondidas
        stats.value.preguntasPendientes = pendientes
        stats.value.porcentajePendientes = data.totalPreguntas > 0 ? Math.round((pendientes / data.totalPreguntas) * 100) : 0
    }

    const fetchStoryStats = async (historia) => {
      if (historia.stats) return
      historia.statsLoading = true
      try {
        const response = await api.get(`/api/historias/${historia.id}/stats`)
        const data = response.data
        historia.stats = {
          ...data,
          progress: data.totalPreguntas > 0 ? Math.round((data.preguntasRespondidas / data.totalPreguntas) * 100) : 0
        }
      } catch (err) {
        console.error(`Error al cargar stats para la historia ${historia.id}`, err)
        $q.notify({ type: 'negative', message: 'No se pudieron cargar las estadísticas de la historia.' })
      } finally {
        historia.statsLoading = false
      }
    }

    const fetchAllData = async () => {
        loading.value = true
        error.value = false
        try {
            await Promise.all([fetchHistorias(), fetchStats()])
        } catch (err) {
            error.value = true
        } finally {
            loading.value = false
        }
    }

    const solicitarMasPreguntas = async (historia) => {
      if (generatingFor.value !== null) return
      
      generatingFor.value = historia.id
      localStorage.setItem(GENERATING_STORY_KEY, historia.id)
      showGeneratingNotification()

      try {
        await api.post(`/api/historias/${historia.id}/generar-preguntas`)
        startPolling(historia.id)
      } catch (err) {
        $q.notify({ type: 'negative', message: err.response?.data?.error || 'Error al iniciar la generación.' })
        clearGeneratingState()
      }
    }

    const evaluarHistoria = (historiaId) => {
      router.push(`/test/${historiaId}`)
    }

    const repetirPreguntas = (historiaId) => {
      router.push(`/test/${historiaId}?modo=repetir`)
    }


    Object.assign(fetchAllData, { fetchHistorias, fetchStats });


    onMounted(async () => {
      await fetchAllData()
      // Comprueba si CUALQUIER tarea está activa al cargar la página
      const pendingStoryId = localStorage.getItem(GENERATING_STORY_KEY)
      if (pendingStoryId) {
        generatingFor.value = parseInt(pendingStoryId)
        showGeneratingNotification()
        startPolling(parseInt(pendingStoryId))
      }
    })

    onUnmounted(() => {
      if (pollingInterval) clearInterval(pollingInterval)
      if (dismissGeneratingNotification) dismissGeneratingNotification()
    })

    return {
      loading,
      error,
      historias,
      stats,
      generatingFor,
      solicitarMasPreguntas,
      fetchAllData,
      evaluarHistoria,
      repetirPreguntas,
      fetchStoryStats
    }
  }
})
</script>

<style lang="scss">
.header-title {
  font-size: 2rem;
  font-weight: 700;
}
.header-subtitle {
    color: $grey-7;
}

.history-card {
  border-radius: 16px !important;
  overflow: hidden;
  background-color: #f8f9ff;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transition: box-shadow 0.3s ease-in-out;
  .history-card-header { padding: 16px 24px; }
}

.status-badge {
  padding: 8px 16px; border-radius: 20px; font-weight: 700;
  font-size: 0.75rem; text-transform: uppercase; color: white;
  &.status-superado { background-color: $positive; }
  &.status-no_superado { background-color: $negative; }
  &.status-pendiente { background-color: $grey-7; }
}


.donut-container { width: 250px; height: 250px; position: relative; }
.stat-card { border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); height: 100%; }
.donut-container-large { width: 200px; height: 200px; margin: auto; }
.donut-container-small { width: 240px; height: 240px; margin: auto; }
</style>
