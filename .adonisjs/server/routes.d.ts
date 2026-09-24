import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'dashboard': { paramsTuple?: []; params?: {} }
    'dashboard.archive': { paramsTuple: [ParamValue]; params: {'day': ParamValue} }
    'refresh': { paramsTuple?: []; params?: {} }
    'preferences.projects': { paramsTuple?: []; params?: {} }
    'settings': { paramsTuple?: []; params?: {} }
    'preferences.scope': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'dashboard': { paramsTuple?: []; params?: {} }
    'dashboard.archive': { paramsTuple: [ParamValue]; params: {'day': ParamValue} }
    'settings': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'dashboard': { paramsTuple?: []; params?: {} }
    'dashboard.archive': { paramsTuple: [ParamValue]; params: {'day': ParamValue} }
    'settings': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'refresh': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'preferences.projects': { paramsTuple?: []; params?: {} }
    'preferences.scope': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}