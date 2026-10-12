import { GenerateCRUDList, GenerateCRUDEdit } from "../lib/CRUDUtils";

export const RedesSocialesList = GenerateCRUDList("redsocial", "redes", {
    include: ['nombre']
});

export const RedesSocialesEdit = GenerateCRUDEdit("redsocial", "redes", {
    include: ["nombre", "inputmask"]});