import { GenerateCRUDList, GenerateCRUDEdit } from "../lib/CRUDUtils";

export const ProveedoresList = GenerateCRUDList("proveedor", "proveedores", {
    include: ["nombre", "telefono", "email", "activo"]
});

export const ProveedoresEdit = GenerateCRUDEdit("proveedor", "proveedores", {
    exclude: ["id", "red_social"]
});
