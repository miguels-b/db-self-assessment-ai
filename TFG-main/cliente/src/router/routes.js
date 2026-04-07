const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'ddl', component: () => import('pages/ddl.vue') },
      { path: 'dml', component: () => import('pages/dml.vue') },
      { path: 'fundamentos', component: () => import('pages/fundamentos.vue') },
      { path: 'conceptual', component: () => import('pages/conceptual.vue') },
      { path: 'logico', component: () => import('pages/logico.vue') },
      { path: 'test/:id', component: () => import('pages/TestPage.vue') }

    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
