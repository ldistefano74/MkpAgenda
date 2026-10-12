import { GenerateCRUDList, GenerateCRUDEdit } from "../lib/CRUDUtils";

export const FuentesContactoList = GenerateCRUDList("fuentecontacto", "fuentescontacto", {
    exclude: ['id']
});

export const FuentesContactoEdit = GenerateCRUDEdit("fuentecontacto", "fuentescontacto", {
    exclude: ["id"]
});