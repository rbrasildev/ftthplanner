
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  username: 'username',
  passwordHash: 'passwordHash',
  createdAt: 'createdAt',
  companyId: 'companyId',
  role: 'role',
  active: 'active'
};

exports.Prisma.CompanyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  planId: 'planId',
  subscriptionExpiresAt: 'subscriptionExpiresAt',
  status: 'status'
};

exports.Prisma.PlanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  price: 'price',
  limits: 'limits',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  name: 'name',
  centerLat: 'centerLat',
  centerLng: 'centerLng',
  zoom: 'zoom',
  settings: 'settings',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  companyId: 'companyId'
};

exports.Prisma.CtoScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  status: 'status',
  lat: 'lat',
  lng: 'lng',
  splitters: 'splitters',
  fusions: 'fusions',
  connections: 'connections',
  inputCableIds: 'inputCableIds',
  layout: 'layout',
  clientCount: 'clientCount',
  catalogId: 'catalogId',
  type: 'type',
  color: 'color',
  reserveLoopLength: 'reserveLoopLength',
  companyId: 'companyId'
};

exports.Prisma.PopScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  status: 'status',
  lat: 'lat',
  lng: 'lng',
  olts: 'olts',
  dios: 'dios',
  fusions: 'fusions',
  connections: 'connections',
  inputCableIds: 'inputCableIds',
  layout: 'layout',
  color: 'color',
  size: 'size',
  companyId: 'companyId'
};

exports.Prisma.CableScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  status: 'status',
  fiberCount: 'fiberCount',
  looseTubeCount: 'looseTubeCount',
  color: 'color',
  coordinates: 'coordinates',
  fromNodeId: 'fromNodeId',
  toNodeId: 'toNodeId',
  catalogId: 'catalogId',
  companyId: 'companyId'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  action: 'action',
  entity: 'entity',
  entityId: 'entityId',
  details: 'details',
  userId: 'userId',
  companyId: 'companyId',
  ipAddress: 'ipAddress',
  createdAt: 'createdAt'
};

exports.Prisma.CatalogSplitterScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  mode: 'mode',
  inputs: 'inputs',
  outputs: 'outputs',
  attenuation: 'attenuation',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  companyId: 'companyId'
};

exports.Prisma.TemplateSplitterScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  mode: 'mode',
  inputs: 'inputs',
  outputs: 'outputs',
  attenuation: 'attenuation',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CatalogCableScalarFieldEnum = {
  id: 'id',
  name: 'name',
  brand: 'brand',
  model: 'model',
  defaultLevel: 'defaultLevel',
  fiberCount: 'fiberCount',
  looseTubeCount: 'looseTubeCount',
  fibersPerTube: 'fibersPerTube',
  attenuation: 'attenuation',
  fiberProfile: 'fiberProfile',
  description: 'description',
  deployedSpec: 'deployedSpec',
  plannedSpec: 'plannedSpec',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  companyId: 'companyId'
};

exports.Prisma.TemplateCableScalarFieldEnum = {
  id: 'id',
  name: 'name',
  brand: 'brand',
  model: 'model',
  defaultLevel: 'defaultLevel',
  fiberCount: 'fiberCount',
  looseTubeCount: 'looseTubeCount',
  fibersPerTube: 'fibersPerTube',
  attenuation: 'attenuation',
  fiberProfile: 'fiberProfile',
  description: 'description',
  deployedSpec: 'deployedSpec',
  plannedSpec: 'plannedSpec',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CatalogBoxScalarFieldEnum = {
  id: 'id',
  name: 'name',
  brand: 'brand',
  model: 'model',
  type: 'type',
  reserveLoopLength: 'reserveLoopLength',
  color: 'color',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  companyId: 'companyId'
};

exports.Prisma.TemplateBoxScalarFieldEnum = {
  id: 'id',
  name: 'name',
  brand: 'brand',
  model: 'model',
  type: 'type',
  reserveLoopLength: 'reserveLoopLength',
  color: 'color',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CatalogPoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  height: 'height',
  strength: 'strength',
  shape: 'shape',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  companyId: 'companyId'
};

exports.Prisma.TemplatePoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  height: 'height',
  strength: 'strength',
  shape: 'shape',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PoleScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  status: 'status',
  lat: 'lat',
  lng: 'lng',
  catalogId: 'catalogId',
  companyId: 'companyId'
};

exports.Prisma.CatalogFusionScalarFieldEnum = {
  id: 'id',
  name: 'name',
  attenuation: 'attenuation',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  companyId: 'companyId'
};

exports.Prisma.TemplateFusionScalarFieldEnum = {
  id: 'id',
  name: 'name',
  attenuation: 'attenuation',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CatalogOLTScalarFieldEnum = {
  id: 'id',
  name: 'name',
  outputPower: 'outputPower',
  slots: 'slots',
  portsPerSlot: 'portsPerSlot',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  companyId: 'companyId'
};

exports.Prisma.TemplateOLTScalarFieldEnum = {
  id: 'id',
  name: 'name',
  outputPower: 'outputPower',
  slots: 'slots',
  portsPerSlot: 'portsPerSlot',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.UserRole = exports.$Enums.UserRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  SUPER_ADMIN: 'SUPER_ADMIN'
};

exports.EquipmentStatus = exports.$Enums.EquipmentStatus = {
  PLANNED: 'PLANNED',
  NOT_DEPLOYED: 'NOT_DEPLOYED',
  DEPLOYED: 'DEPLOYED',
  CERTIFIED: 'CERTIFIED',
  ANALYSING: 'ANALYSING',
  LICENSED: 'LICENSED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Company: 'Company',
  Plan: 'Plan',
  Project: 'Project',
  Cto: 'Cto',
  Pop: 'Pop',
  Cable: 'Cable',
  AuditLog: 'AuditLog',
  CatalogSplitter: 'CatalogSplitter',
  TemplateSplitter: 'TemplateSplitter',
  CatalogCable: 'CatalogCable',
  TemplateCable: 'TemplateCable',
  CatalogBox: 'CatalogBox',
  TemplateBox: 'TemplateBox',
  CatalogPole: 'CatalogPole',
  TemplatePole: 'TemplatePole',
  Pole: 'Pole',
  CatalogFusion: 'CatalogFusion',
  TemplateFusion: 'TemplateFusion',
  CatalogOLT: 'CatalogOLT',
  TemplateOLT: 'TemplateOLT'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
