# BitChat – Roadmap de funcionalidades

## ✅ Hecho
- Conexión MongoDB local
- Modelos: User, Chat, Message (con reacciones, leído, fijado, etc. en esquema)
- Registro e inicio de sesión (JWT) – `POST /auth/register`, `POST /auth/login`
- Persistir mensajes en MongoDB
- Cargar historial al abrir un chat (`chat_history`)
- Enviar mensajes (tiempo real + guardado)
- Mostrar hora del mensaje (en UI)

---

## Fase 1 – Auth y base ✅
- [x] Frontend: pantalla Login / Register
- [x] Guardar JWT y enviar en Socket (middleware socket con JWT)
- [x] Proteger rutas/socket con usuario autenticado

---

## Fase 2 – Chat personal y amigos ✅
- [x] **Chat personal** (1 a 1): crear chat directo entre dos usuarios
- [x] **Añadir amigos**: modelo Friendship, listar amigos, solicitudes enviadas/recibidas
- [x] **Buscar usuarios**: endpoint y UI para buscar por nombre/email
- [x] **Bloquear gente**: `User.blockedUsers`, filtrar en búsqueda; botón bloquear en chat directo

---

## Fase 3 – Grupos y UX de chat
- [x] **Hacer grupos**: crear chat tipo `group`, añadir participantes, nombre e imagen
- [x] **Fijar chat**: usar `Chat.pinnedBy`, lista de fijados arriba
- [x] **Chat archivado**: usar `Chat.archivedBy`, vista de archivados
- [x] **Apodar usuario**: usar `User.nickname` o apodo por chat

---

## Fase 4 – Contenido del mensaje
- [x] **Enviar imágenes**: subida (multer + almacenamiento o cloud), `Message.type: 'image'`, `imageUrl`
- [x] **Enviar emojis**: picker en input, guardar como texto o `Message.type: 'emoji'`
- [x] **Poner stickers**: `Message.type: 'sticker'`, `stickerUrl` o pack de stickers
- [x] **Reacción a mensajes**: usar `Message.reactions[]`, evento socket para añadir/quitar

---

## Fase 5 – Edición y estado
- [x] **Editar mensaje**: PATCH mensaje, `Message.editedAt`, evento socket
- [x] **Mostrar mensaje leído**: `Message.readBy[]`, marcar al abrir chat, indicador en UI
- [x] **Fijar un mensaje**: `Message.pinned`, mostrar arriba en el chat

---

## Fase 6 – Perfil y preferencias
- [x] **Foto de perfil**: subir imagen, `User.avatar`
- [x] **Fondos de chat**: `Chat.chatBackground`, selector en UI
- [x] **Modo oscuro**: tema en frontend (ya tienes oscuro; añadir toggle y persistir)
- [x] **Modo invisible**: usar `User.visibility`, no mostrar “en línea” a otros

---

## Fase 7 – Limpieza y moderación
- [x] **Borrar conversación**: borrar mensajes para el usuario o para todos (soft delete)
- [x] **Eliminar mensaje**: solo propio o con permisos en grupo

---

## Orden sugerido para implementar
1. Login/Register en frontend + usar JWT en socket.
2. Chat personal (crear chat 1-1) y listar “mis chats”.
3. Añadir amigos + buscar usuarios.
4. Enviar imágenes (upload + mensaje tipo imagen).
5. Reacciones, editar mensaje, leer/entregado.
6. Grupos, fijar chat, archivados.
7. Resto (stickers, fondos, modo invisible, bloquear, etc.).
