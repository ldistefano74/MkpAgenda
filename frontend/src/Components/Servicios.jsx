import { GenerateCRUDList } from "../lib/CRUDUtils";
import ServicioForm from "./ServicioForm";

export const ServiciosList = GenerateCRUDList("servicio", "servicios", {
    exclude: ['id', 'descripcion']
});

export const ServiciosEdit = ServicioForm;