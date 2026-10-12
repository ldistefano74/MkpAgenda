# Framework de Reportes

Base reutilizable para páginas de **informes** (no CRUD). Sigue el patrón
"query/report view": una sección de **filtros** arriba y una **grilla** de
resultados abajo, con **fetch explícito** (el usuario arma los filtros y presiona
**Generar**).

> Cuando pidas "un reporte de X con filtros Y", esto es lo que se usa como base.

## Componentes

Todo vive en `frontend/src/Components/Reports/`.

| Archivo | Rol |
|---|---|
| `ReportPageContainer.jsx` | Contenedor base. Provee el contexto, botones Generar/Limpiar, arma el query string, hace el fetch y renderiza la grilla. **API pública.** |
| `ReportField.jsx` | Wrappers de filtros (`ReportField.DateRange / .Lookup / .Select / .Text`). Se auto-registran y reportan su valor. **API pública.** |
| `ReportContext.js` | Contexto interno que comparte estado entre contenedor y filtros. *No usar directo.* |
| `useReportFilter.js` | Hook interno que usan los wrappers para registrarse. *No es API pública.* |

## Cómo funciona (mental model)

1. `ReportPageContainer` provee un **contexto** con el estado de los filtros.
2. Cada `ReportField.*` que ponés como child se **auto-registra** en ese contexto
   (su `name`, su valor por defecto y su metadata como `required`) y reporta su
   valor cuando el usuario lo cambia. **No cableás estado de filtros a mano.**
3. Hay dos estados de filtros separados:
   - **draft**: lo que el usuario está editando.
   - **applied**: lo del último **Generar**. La grilla muestra siempre el
     *applied*, no el draft.
4. Al presionar **Generar**, el contenedor arma el query string con los valores
   *no vacíos* y hace `GET /${endpoint}/?<filtros>`.
5. **Limpiar** restaura los valores por defecto de cada filtro y vuelve al estado
   "sin generar".

### Regla clave: vacío = "todos"

Un filtro vacío **se omite** del query string. Es decir, "sin filtro" le llega al
backend como "todos". No hay que hacer nada especial para eso. El backend debe
tratar la ausencia de un param como "no filtrar por ese campo".

- `DateRange` vacío ⇒ "todos desde / hasta".
- `Select` no obligatorio ⇒ antepone una opción **"Todos"** (`value=''`) para poder
  volver a vacío (un Select de MUI no se puede des-elegir de otra forma).
- `Lookup` ⇒ se limpia con la X del autocomplete.

## Filtros disponibles (`ReportField.*`)

### `DateRange`
Rango de fechas. Registra **dos** query params: `${name}_desde` y `${name}_hasta`.

```jsx
<ReportField.DateRange name="fecha" label="Fecha" />
```

| Prop | Default | Descripción |
|---|---|---|
| `name` | — | Base de las keys (`_desde` / `_hasta`) |
| `label` | — | Prefijo de las etiquetas |
| `defaultDays` | `30` | Sugiere los últimos N días. `null` = arranca vacío |
| `defaultMonths` | — | Sugiere los últimos N meses completos (desde = día 1 del mes, hasta = hoy). Tiene prioridad sobre `defaultDays` si se pasan los dos |
| `required` | `false` | Exige ambos extremos antes de generar |

> Ojo: con `defaultDays`/`defaultMonths` seteado el rango nunca arranca vacío, así
> que `required` es inocuo salvo que combines `required defaultDays={null}`.

### `Lookup`
Selección contra un endpoint de lookup del backend (`/api/lookup/<lookup>/`).

```jsx
<ReportField.Lookup name="medio_pago_cobro" lookup="mediopagocobro" label="Medio" />
```

| Prop | Default | Descripción |
|---|---|---|
| `name` | — | Key del query param |
| `lookup` | — | Nombre del lookup backend |
| `label` | — | Etiqueta |
| `filterParams` | `{}` | Filtros para el lookup (ej: `{ activo: true }`) |
| `required` | `false` | Obligatorio |

### `Select`
Selección sobre un conjunto fijo de opciones (choices estáticos).

```jsx
<ReportField.Select
  name="tipo"
  label="Tipo"
  choices={[{ value: 'I', display_name: 'Cobro' }, { value: 'E', display_name: 'Pago' }]}
/>
```

| Prop | Default | Descripción |
|---|---|---|
| `name` | — | Key del query param |
| `choices` | — | `[{ value, display_name }]` |
| `defaultValue` | `''` | Valor inicial |
| `allLabel` | `'Todos'` | Etiqueta de la opción vacía (si no es obligatorio) |
| `required` | `false` | Obligatorio (sin opción "Todos") |

### `Text`
Texto libre.

```jsx
<ReportField.Text name="concepto" label="Concepto" />
```

| Prop | Default | Descripción |
|---|---|---|
| `name` | — | Key del query param |
| `required` | `false` | Obligatorio |

## `ReportPageContainer` — props

| Prop | Requerido | Descripción |
|---|---|---|
| `endpoint` | ✅ | Endpoint del informe. Se consulta `GET /${endpoint}/?<filtros>` |
| `title` | ✅ | Título de la página |
| `columns` | ✅ | Columnas de la grilla (formato MUI DataGrid, sin columna de acciones) |
| `children` | — | Los filtros (`ReportField.*`) |
| `getRowId` | — | Id único de cada fila (default `row => row.id`) |
| `summary` | — | Render de totales; recibe las filas: `(rows) => <Node/>` |
| `initialSortModel` | — | Orden inicial, ej: `[{ field: 'fecha', sort: 'asc' }]` |
| `actions` | — | Nodo para el slot del header (ej: botón de exportar a PDF) |
| `getRowEditUrl` | — | `(row) => string \| null`. Si se provee, agrega una acción por fila que abre esa URL **en una pestaña nueva**. Devolver `null` oculta la acción para esa fila |
| `getDetailPanelContent` | — | `(row) => ReactNode`. Si se provee, agrega una columna de flecha que despliega ese contenido debajo de la fila (drilldown) |

### Drilldown de filas (`getDetailPanelContent`)

MUI X Community (la edición gratuita, sin `-pro`) no tiene detail panels
nativos — eso es una feature de Pro. `BaseDataGrid` lo resuelve con el truco
de **colSpan**: al expandir una fila se inyecta debajo una fila sintética
cuya primera celda hace `colSpan` a todo el ancho de la grilla y renderiza el
nodo devuelto por `getDetailPanelContent(row)`.

```jsx
<ReportPageContainer
  // ...
  getDetailPanelContent={(row) => <MiDetalle row={row} />}
>
```

El contenido del detalle es **React libre**: no tiene que ser otra grilla.
Para sub-niveles adicionales (drilldown de más de un nivel), el patrón usado
es anidar `Accordion` dentro de ese contenido en vez de intentar otro nivel
de filas de grilla — mucho más simple que pelear con el modelo de filas
planas del DataGrid. Ver `ResultadosPeriodoDetail.jsx` (usado por
`ResultadosReport`): despliega 3 `Accordion` fijos (Ingresos/Costos/Pagos) que
recién hacen `fetch` de su detalle al expandirse.

> **Limitación conocida:** mientras `getDetailPanelContent` esté seteado,
> `BaseDataGrid` deshabilita el sorting por columna. La fila sintética se
> inserta inmediatamente después de su fila padre en el array de `rows`; si
> el usuario pudiera reordenar por columna, esa posición se rompería.

### Acción de edición por fila (`getRowEditUrl`)

Como un informe puede unificar filas de **distintas fuentes**, la URL de edición
depende de la fila. En vez de acoplar la base a una entidad, el reporte provee
`getRowEditUrl(row)` y la base renderiza la acción, que **abre el registro en una
pestaña nueva** (útil para no perder el informe filtrado). Devolver `null` para
una fila que no tiene página de edición la deja sin acción.

```jsx
const getRowEditUrl = (row) => {
  if (row.origen === 'costo') return `/costos/${row.id}/edit`;
  if (row.origen === 'movimiento' && row.evento_id) return `/eventos/${row.evento_id}/edit`;
  return null; // fila no navegable (ej: movimiento de cuenta corriente sin evento)
};
```

> El backend debe incluir en cada fila lo que `getRowEditUrl` necesite para
> construir la URL (ej: `origen`, `id`, `evento_id`).

## Cómo agregar un reporte nuevo (receta)

1. **Componente** en `frontend/src/Components/Reports/<Nombre>Report.jsx`:

```jsx
import ReportPageContainer from './ReportPageContainer';
import ReportField from './ReportField';

const columns = [
  { field: 'fecha', headerName: 'Fecha', width: 110,
    valueFormatter: (value) => value ? new Date(value).toLocaleDateString('es-AR') : '' },
  { field: 'concepto', headerName: 'Concepto', flex: 1, minWidth: 200 },
  { field: 'importe', headerName: 'Importe', width: 140, align: 'right', headerAlign: 'right',
    valueFormatter: (value) => `$${Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` },
];

export default function MiReporte() {
  return (
    <ReportPageContainer
      endpoint="reportes/mi-reporte"
      title="Mi informe"
      columns={columns}
      getRowId={(row) => row.id}
      initialSortModel={[{ field: 'fecha', sort: 'asc' }]}
    >
      <ReportField.DateRange name="fecha" label="Fecha" />
      <ReportField.Lookup name="cliente" lookup="cliente" label="Cliente" />
    </ReportPageContainer>
  );
}
```

2. **Ruta** en `frontend/src/App.jsx`: importar el componente y agregar
   `{ path: '/reportes/mi-reporte', Component: MiReporte }` dentro de los children
   del router.

3. **Sidebar** en `frontend/src/Components/Layout/DashboardSidebar.jsx`: agregar un
   `DashboardSidebarPageItem` bajo la sección **Informes**.

4. **Backend**: exponer `GET /api/reportes/mi-reporte/` que reciba los filtros como
   query params y devuelva las filas ya normalizadas para las columnas. Recordá:
   un param ausente = "no filtrar por ese campo". La lógica va en
   `API/querysets/` o `API/services/` (los views solo hacen I/O HTTP).

## Notas de firma (gotchas)

- **`valueFormatter`** usa la firma de MUI X v7+: `(value) => ...` (el valor
  directo, no `params`). Consistente con el resto del proyecto.
- **`getRowId`**: si el informe unifica filas de distintas fuentes (ej: cobros +
  pagos + costos), los `id` pueden colisionar. Usá una key compuesta:
  `getRowId={(row) => `${row.origen}-${row.id}`}`.

## Exportación

- **CSV / imprimir** ya vienen gratis por la toolbar del `BaseDataGrid`
  (`variant="page"` activa `showToolbar`).
- **PDF "prolijo"** (encabezado con rango de fechas, totales, layout formal) se
  resuelve **server-side** y se cuelga del slot `actions` del contenedor. No está
  implementado todavía.

## Lo que NO hace (todavía)

Persistencia de filtros en URL/localStorage, agrupamiento/pivote, paginación
server-side. Se agregan cuando un reporte lo necesite (YAGNI).
```
