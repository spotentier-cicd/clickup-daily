import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'dashboard': { paramsTuple?: []; params?: {} }
    'dashboard.archive': { paramsTuple: [ParamValue]; params: {'day': ParamValue} }
    'refresh': { paramsTuple?: []; params?: {} }
    'preferences.projects': { paramsTuple?: []; params?: {} }
    'kanban.store': { paramsTuple?: []; params?: {} }
    'kanban.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kanban.move': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kanban.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'kanban.store': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'preferences.projects': { paramsTuple?: []; params?: {} }
    'kanban.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kanban.move': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'preferences.scope': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'kanban.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}