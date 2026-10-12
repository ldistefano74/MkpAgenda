import { GenerateCRUDList } from "../lib/CRUDUtils";

// Lista de clientes generada automáticamente
export const ClientesList = GenerateCRUDList("cliente", "clientes", {
    include: ["favorito", "nombre", "telefono", "email"],
});

// Formulario específico de clientes usando BaseCrudPageContainer
export { default as ClientesEdit } from './ClienteForm';
