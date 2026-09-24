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
