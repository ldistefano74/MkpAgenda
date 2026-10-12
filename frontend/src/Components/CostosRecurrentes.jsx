import { GenerateCRUDList, GenerateCRUDEdit } from "../lib/CRUDUtils";

export const CostosRecurrentesList = GenerateCRUDList("costorecurrentelistserializer", "costosrecurrentes", {
    include: ['nombre', 'categoria_costo_nombre', 'proveedor_nombre', 'recurrencia_display', 'activo']
});

export const CostosRecurrentesEdit = GenerateCRUDEdit("costorecurrente", "costosrecurrentes", {
    exclude: ["id"]
});
