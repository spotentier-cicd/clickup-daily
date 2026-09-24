import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'dashboard': { paramsTuple?: []; params?: {} }
    'dashboard.archive': { paramsTuple: [ParamValue]; params: {'day': ParamValue} }
    'refresh': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'dashboard': { paramsTuple?: []; params?: {} }
    'dashboard.archive': { paramsTuple: [ParamValue]; params: {'day': ParamValue} }
  }
  HEAD: {
    'dashboard': { paramsTuple?: []; params?: {} }
    'dashboard.archive': { paramsTuple: [ParamValue]; params: {'day': ParamValue} }
  }
  POST: {
    'refresh': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}