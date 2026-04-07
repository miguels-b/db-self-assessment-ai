<template>
  <q-page padding>
    <!-- Cabecera -->
    <div class="q-mb-xl">
      <div class="header-title">Asignatura: Bases de datos</div>
      <div class="header-subtitle">Comprueba tu avance</div>
    </div>
    
    <!-- Estado de Carga y Error -->
    <div v-if="loading" class="text-center">
      <q-spinner-dots color="primary" size="40px" />
      <div class="q-mt-md text-grey-8">Cargando estadísticas...</div>
    </div>
     <div v-else-if="error" class="text-center">
        <q-icon name="error_outline" color="negative" size="50px" />
        <div class="q-mt-md text-h6">No se pudieron cargar las estadísticas</div>
        <p class="text-grey-8">Asegúrate de que el servidor backend esté funcionando.</p>
        <q-btn label="Intentar de nuevo" color="primary" @click="fetchDashboardData" class="q-mt-md" unelevated rounded />
    </div>

    <!-- Grid del Dashboard -->
    <div v-else class="q-col-gutter-lg row items-stretch">
      <!-- Gráfico de progreso -->
      <div class="col-12 col-lg-8">
        <q-card class="dashboard-card main-chart-card full-height">
          <q-card-section>
            <div class="card-title">Progreso de preguntas por objetivo</div>
          </q-card-section>
          <q-card-section>
             <apexchart type="bar" height="350" :options="progressChartOptions" :series="progressChartSeries"></apexchart>
          </q-card-section>
        </q-card>
      </div>
      
      <!-- Tarjeta de Historias Totales (ahora arriba a la derecha) -->
      <div class="col-12 col-lg-4">
          <q-card class="dashboard-card main-chart-card full-height">
              <q-card-section>
                  <div class="card-title">Historias totales</div>
                  <apexchart type="donut" height="345" :options="storiesChartOptions" :series="storiesChartSeries"></apexchart>
              </q-card-section>
          </q-card>
      </div>

      <!-- Tarjeta de Preguntas Disponibles (abajo izquierda) -->
      <div class="col-12 col-md-4">
        <q-card class="dashboard-card metric-card">
            <q-card-section>
                <div class="card-title"><q-icon name="quiz" class="q-mr-sm" />Preguntas disponibles</div>
                <div class="metric-value-large q-mt-md">{{ stats.preguntasDisponibles }}</div>
            </q-card-section>
        </q-card>
      </div>

      <!-- Tarjeta de Preguntas Pendientes (abajo centro) -->
      <div class="col-12 col-md-4">
        <q-card class="dashboard-card metric-card">
            <q-card-section>
                <div class="card-title"><q-icon name="person_search" class="q-mr-sm" />Preguntas pendientes</div>
                  <div class="row items-baseline q-mt-md">
                    <div class="metric-value-large q-mr-md">{{ stats.preguntasPendientes }}</div>
                    <div class="metric-percentage" style="color: #6a6a6a;">{{ stats.porcentajePendientes }}%</div>
                </div>
            </q-card-section>
        </q-card>
      </div>
      
      <!-- Tarjeta de Objetivos Superados (ahora abajo a la derecha) -->
      <div class="col-12 col-md-4">
          <q-card class="dashboard-card metric-card">
              <q-card-section>
                  <div class="row items-center no-wrap">
                      <div class="col">
                          <div class="card-title">
                              <q-icon name="emoji_events" class="q-mr-sm" />Objetivos superados
                          </div>
                          <div class="row items-baseline q-mt-sm">
                              <div class="metric-value-small q-mr-md">{{ stats.objetivosSuperados }}</div>
                              <div class="metric-percentage">{{ stats.porcentajeSuperados }}%</div>
                          </div>
                      </div>
                  </div>
              </q-card-section>
          </q-card>
      </div>

    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { api } from 'boot/axios'
import { useQuasar } from 'quasar'

export default defineComponent({
  name: 'IndexPage',
  components: {
    apexchart: VueApexCharts,
  },
  setup () {
    const $q = useQuasar()
    const loading = ref(true)
    const error = ref(false)

    // Define la estructura de datos para el estado inicial
    const stats = ref({
        objetivosSuperados: 0,
        porcentajeSuperados: 0,
        preguntasDisponibles: 0,
        preguntasPendientes: 0,
        porcentajePendientes: 0,
        historiasTotales: 0
    });
    
    // --- Opciones de los Gráficos ---

    // GRÁFICO DE BARRAS: stacked: false para barras separadas
    const progressChartOptions = ref({
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        plotOptions: { bar: { horizontal: false, columnWidth: '70%', borderRadius: 4 } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: { categories: [] },
        yaxis: { title: { text: '% Avance' } },
        fill: { opacity: 1 },
        legend: { position: 'top', horizontalAlign: 'left', offsetX: 40 },
        colors: ['#34a853', '#bdc1c6', '#ea4335'], // Verde, Gris, Rojo
        tooltip: { y: { formatter: (val) => val + "%" } }
    });
    const progressChartSeries = ref([]);

    // GRÁFICO DE DONUT: para representar partes de un todo
    const storiesChartOptions = ref({
        chart: { type: 'donut', height: 360 },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        name: { show: true, offsetY: -10 },
                        value: { show: true, offsetY: 10,
                            formatter: (val, { seriesIndex, w }) => {
                                // Muestra el número absoluto en lugar del porcentaje
                                return w.globals.series[seriesIndex]
                            }
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'Total Historias',
                            formatter: () => stats.value.historiasTotales
                        }
                    }
                }
            }
        },
        // EFECTO HOVER OSCURECIDO
        states: {
          hover: {
            filter: {
              type: 'darken',
              value: 0.85
            }
          }
        },
        dataLabels: { enabled: false },
        colors: ['#ea4335', '#34a853', '#bdc1c6'], // Suspensos, Aprobados, Pendientes
        labels: ['Suspensos', 'Aprobados', 'Pendientes'],
        legend: { show: true, position: 'bottom' }
    });
    const storiesChartSeries = ref([]);


    // --- Función para llamar al backend ---
    const fetchDashboardData = async () => {
        loading.value = true
        error.value = false
        try {
            const response = await api.get('/api/dashboard/stats')
            const data = response.data;
            
            if (data && data.stats) stats.value = data.stats
            if (data && data.storiesChartData) storiesChartSeries.value = data.storiesChartData
            if (data && data.progressChartData) {
                progressChartSeries.value = data.progressChartData.series;

                // ABREVIAR ETIQUETA LARGA
                const categories = data.progressChartData.categories.map(cat => 
                    cat === 'Fundamentos de Bases de Datos' ? 'Fundamentos BBDD' : cat
                );

                progressChartOptions.value = { 
                    ...progressChartOptions.value,
                    xaxis: { categories: categories }
                };
            }
        } catch (err) {
            console.error("Error al cargar las estadísticas:", err)
            error.value = true
            $q.notify({ 
              type: 'negative', 
              message: 'No se pudo conectar con el servidor.',
              caption: 'Por favor, verifica que el backend está funcionando.',
              position: 'top'
            })
        } finally {
            loading.value = false
        }
    }

    // --- Lifecycle Hook ---
    onMounted(fetchDashboardData)

    return {
      stats,
      loading,
      error,
      fetchDashboardData,
      progressChartOptions,
      progressChartSeries,
      storiesChartOptions,
      storiesChartSeries
    }
  }
})
</script>

<style lang="scss">
.dashboard-card {
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    border: none;
}
.main-chart-card {
    background-color: #f8f9ff;
}
.metric-card {
    background-color: #e3eafc;
}
.card-title {
    font-size: 1rem;
    font-weight: 500;
    color: #5f6368;
}
.metric-value-large {
    font-size: 3rem;
    font-weight: 700;
    color: #1d1d1d;
    line-height: 1;
}
.metric-value-small {
    font-size: 2rem;
    font-weight: 700;
    color: #1d1d1d;
}
.metric-percentage {
    font-size: 1.5rem;
    font-weight: 500;
    color: #34a853;
}
.header-title {
    font-size: 2rem;
    font-weight: 700;
}
.header-subtitle {
    color: #5f6368;
}
</style>
