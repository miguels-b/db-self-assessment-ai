<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Cabecera mejorada -->
    <q-header elevated class="bg-header text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
          class="q-mr-md"
        />
        <q-toolbar-title class="text-h6 text-weight-bold">
          Generador de Recursos de Aprendizaje
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <!-- Menú lateral modernizado -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      :width="260"
      class="main-drawer"
    >
      <q-scroll-area class="fit">
        <!-- Logo con estilo limpio -->
        <div class="app-logo q-pa-lg text-center">
          <q-icon name="lightbulb" size="4em" class="logo-icon" />
          <div class="logo-text q-mt-md">TFG - Miguel Sánchez-Beato</div>
        </div>

        <q-separator dark class="q-my-md" />

        <q-list padding class="nav-list">
          <q-item clickable v-ripple to="/" exact class="nav-item">
            <q-item-section avatar><q-icon name="home" /></q-item-section>
            <q-item-section><q-item-label>Inicio</q-item-label></q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/fundamentos" class="nav-item">
            <q-item-section avatar><q-icon name="storage" /></q-item-section>
            <q-item-section><q-item-label>Fundamentos BBDD</q-item-label></q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/conceptual" class="nav-item">
            <q-item-section avatar><q-icon name="settings_applications" /></q-item-section>
            <q-item-section><q-item-label>Diseño Conceptual</q-item-label></q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/logico" class="nav-item">
            <q-item-section avatar><q-icon name="schema" /></q-item-section>
            <q-item-section><q-item-label>Diseño Lógico</q-item-label></q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/ddl" class="nav-item">
            <q-item-section avatar><q-icon name="code" /></q-item-section>
            <q-item-section><q-item-label>DDL</q-item-label></q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/dml" class="nav-item">
            <q-item-section avatar><q-icon name="data_usage" /></q-item-section>
            <q-item-section><q-item-label>DML</q-item-label></q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <!-- Contenido principal con fondo claro -->
    <q-page-container class="bg-grey-1">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'MainLayout',
  setup () {
    const leftDrawerOpen = ref(false)

    return {
      leftDrawerOpen,
      toggleLeftDrawer () {
        leftDrawerOpen.value = !leftDrawerOpen.value
      }
    }
  }
})
</script>

<style lang="scss">
$drawer-bg: #34495e; // Azul gris oscuro
$drawer-text: #ecf0f1; // Gris claro
$drawer-text-active: #ffffff;
$active-border: #3498db;
$header-bg: #2c3e50; // Gris oscuro (barra superior)

.bg-header {
  background-color: $header-bg !important;
}

.main-drawer {
  background-color: $drawer-bg;
  color: $drawer-text;
  border-right: none !important;
}

.app-logo {
  .logo-icon {
    color: $drawer-text-active;
  }
  .logo-text {
    font-size: 1.1rem;
    font-weight: 600;
    color: $drawer-text-active;
  }
}

.nav-list {
  padding-top: 0;
}

.nav-item {
  padding: 10px 20px;
  border-left: 4px solid transparent;
  transition: all 0.3s ease;
  border-radius: 4px;

  .q-item__section--avatar {
    color: inherit;
    opacity: 0.8;
  }

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

.q-router-link--active {
  background-color: rgba(255, 255, 255, 0.1);
  color: $drawer-text-active !important;
  font-weight: 600;
  border-left: 4px solid $active-border;

  .q-item__section--avatar {
    opacity: 1;
  }
}

.q-page-container {
  background-color: #f4f5f8 !important;
}
</style>
