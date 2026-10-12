import { GenerateCRUDList, GenerateCRUDEdit } from "../lib/CRUDUtils";

export const TipoEventoList = GenerateCRUDList("tiposevento", "tiposevento", {
    exclude: ['id']
});

export const TipoEventoEdit = GenerateCRUDEdit("tiposevento", "tiposevento", {
    include: ["nombre", "template_presupuesto", "activo"]
});