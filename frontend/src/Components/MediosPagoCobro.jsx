import { GenerateCRUDList, GenerateCRUDEdit } from "../lib/CRUDUtils";

export const MediosPagoCobroList = GenerateCRUDList("mediopagocobro", "mediospagocobro", {
    exclude: ['id']
});

export const MediosPagoCobroEdit = GenerateCRUDEdit("mediopagocobro", "mediospagocobro", {
    exclude: ["id"]
});
