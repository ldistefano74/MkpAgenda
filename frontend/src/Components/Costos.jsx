import { GenerateCRUDList } from "../lib/CRUDUtils";
import CostoForm from "./CostoForm";

export const CostosList = GenerateCRUDList("costolistserializer", "costos", {
    include: ['fecha', 'categoria_costo_nombre', 'descripcion', 'importe', 'medio_pago_nombre', 'evento_display', 'proveedor_nombre'],
    columnOverrides: {
        descripcion: { width: 250, flex: undefined, minWidth: undefined },
    },
});

export const CostosEdit = CostoForm;
