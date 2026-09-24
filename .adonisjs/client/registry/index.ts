/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['dashboard']['types'],
  },
  'dashboard.archive': {
    methods: ["GET","HEAD"],
    pattern: '/r/:day',
    tokens: [{"old":"/r/:day","type":0,"val":"r","end":""},{"old":"/r/:day","type":1,"val":"day","end":""}],
    types: placeholder as Registry['dashboard.archive']['types'],
  },
  'refresh': {
    methods: ["POST"],
    pattern: '/refresh',
    tokens: [{"old":"/refresh","type":0,"val":"refresh","end":""}],
    types: placeholder as Registry['refresh']['types'],
  },
  'preferences.projects': {
    methods: ["PUT"],
    pattern: '/preferences/projects',
    tokens: [{"old":"/preferences/projects","type":0,"val":"preferences","end":""},{"old":"/preferences/projects","type":0,"val":"projects","end":""}],
    types: placeholder as Registry['preferences.projects']['types'],
  },
  'settings': {
    methods: ["GET","HEAD"],
    pattern: '/parametres',
    tokens: [{"old":"/parametres","type":0,"val":"parametres","end":""}],
    types: placeholder as Registry['settings']['types'],
  },
  'preferences.scope': {
    methods: ["PUT"],
    pattern: '/preferences/scope',
    tokens: [{"old":"/preferences/scope","type":0,"val":"preferences","end":""},{"old":"/preferences/scope","type":0,"val":"scope","end":""}],
    types: placeholder as Registry['preferences.scope']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
