const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const multer = require('multer'); // Sumamos multer para la captura

const app = express();

app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DE RESEND (Mantenemos tu clave intacta)
const resend = new Resend('re_i9fDNs1y_BGNX2YABPXtWuQDCFB7AnVf2');

// CONFIGURACIÓN DE MULTER: Guarda la foto temporalmente en memoria para procesarla
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// El endpoint ahora usa upload.single('comprobante') para atrapar la imagen
app.post('/api/pedido', upload.single('comprobante'), async (req, res) => {
    try {
        // Obtenemos las variables. Como viaja por FormData, deserializamos 'cliente' y 'pedido'
        const cliente = JSON.parse(req.body.cliente);
        const pedido = JSON.parse(req.body.pedido);
        const total = req.body.total;

        if (!cliente || !pedido || pedido.length === 0) {
            return res.status(400).json({ ok: false, mensaje: 'Datos del pedido incompletos.' });
        }

        // Generamos el número de orden de entrada para usarlo en el nombre del adjunto
        const numeroOrden = 'ORD-' + Math.floor(Math.random() * 90000 + 10000);

        // Armamos el detalle de los productos en HTML
        let detalleHtml = '';
        pedido.forEach(item => {
            detalleHtml += `<li><strong>${item.nombre}</strong>: ${item.kilos} kg</li>`;
        });

        // ARREGLO DE ADJUNTOS PARA RESEND: Si el cliente subió foto, se la pegamos al mail
        const attachments = [];
        if (req.file) {
            attachments.push({
                filename: `comprobante-${numeroOrden}.jpg`,
                content: req.file.buffer // Resend lee el buffer directamente de Multer
            });
        }

        // ENVIAMOS EL CORREO USANDO RESEND (Mantenemos tu configuración de remitente y destinatarios)
        await resend.emails.send({
            from: 'Mafalda Chipa Factory <ventas@mafaldachipa.com>', 
            to: cliente.email, 
            bcc: 'chipa.mafalda@gmail.com', // Te sigue llegando la copia oculta a vos
            subject: `Confirmación de Pedido - ${cliente.razonSocial}`,
            attachments: attachments, // Adjuntamos la captura aquí
            html: `
                <div style="font-family: sans-serif; color: #2c2520;">
                    <h2>¡Hola ${cliente.razonSocial}! Recibimos tu pedido correctamente.</h2>
                    <p>Muchas gracias por comprar en <strong>Mafalda's Chipa Factory</strong>. Acá tenés el resumen de tu solicitud:</p>
                    <p style="font-style: italic; color: #666;">...del horno al corazón</p>
                    <hr>
                    <p><strong>Dirección de Entrega:</strong> ${cliente.direccion}, ${cliente.ciudad} (CP: ${cliente.cp})</p>
                    <p><strong>Forma de Pago elegida:</strong> ${cliente.pago}</p>
                    ${cliente.notes ? `<p><strong>Notas temporales:</strong> ${cliente.notes}</p>` : ''}
                    <hr>
                    <h3>Detalle de tu Compra (Nro Orden: ${numeroOrden}):</h3>
                    <ul>${detalleHtml}</ul>
                    <h3>Total Estimado: ${total}</h3>
                    <br>
                    ${req.file ? `<p style="color: green; font-weight: bold;">✓ Adjuntamos la captura de pantalla de tu comprobante de pago en este correo.</p>` : ''}
                    <p>Nos vamos a estar comunicando con vos al número <strong>${cliente.telefono}</strong> para coordinar el día y horario de la entrega.</p>
                    <p>Saludos cordiales,</p>
                    <h4>El equipo de Mafalda's</h4>
                </div>
            `
        });

        // Respondemos con éxito al navegador
        return res.status(200).json({
            ok: true,
            mensaje: 'Pedido recibido correctamente',
            orden: numeroOrden
        });

    } catch (error) {
        console.error('Error detallado en el servidor:', error);
        return res.status(500).json({ ok: false, mensaje: 'Error al procesar el envío de la confirmación.' });
    }
});

// Puerto dinámico de Render o 3000 local
const puertoServer = process.env.PORT || 3000;

app.listen(puertoServer, () => {
    console.log(`Servidor backend corriendo en el puerto ${puertoServer}`);
});
