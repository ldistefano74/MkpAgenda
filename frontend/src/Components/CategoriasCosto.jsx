import { GenerateCRUDList, GenerateCRUDEdit } from "../lib/CRUDUtils";

export const CategoriasCostoList = GenerateCRUDList("categoriacosto", "categoriascosto", {
    exclude: ["id"]
});

export const CategoriasCostoEdit = GenerateCRUDEdit("categoriacosto", "categoriascosto", {
    exclude: ["id"]
});
