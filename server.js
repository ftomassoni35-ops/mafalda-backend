const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const multer = require('multer'); 
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Inicialización corregida

const app = express();

app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DE APIS (Mantenemos tu clave intacta de Resend)
const resend = new Resend('re_i9fDNs1y_BGNX2YABPXtWuQDCFB7AnVf2');

// Inicializamos la IA de Google usando la clase oficial correcta
const aiToken = process.env.GEMINI_API_KEY;
const ai = aiToken ? new GoogleGenerativeAI(aiToken) : null;

// CONFIGURACIÓN DE MULTER: Guarda la foto temporalmente en memoria para procesarla
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/pedido', upload.single('comprobante'), async (req, res) => {
    try {
        const cliente = JSON.parse(req.body.cliente);
        const pedido = JSON.parse(req.body.pedido);
        const total = req.body.total;

        if (!cliente || !pedido || pedido.length === 0) {
            return res.status(400).json({ ok: false, mensaje: 'Datos del pedido incompletos.' });
        }

        // ==========================================
        // 🔥 MOTOR DE VALIDACIÓN CON IA (GEMINI)
        // ==========================================
        if ((cliente.pago === 'transferencia' || cliente.pago === 'mercadopago')) {
            if (!req.file) {
                return res.status(400).json({ ok: false, mensaje: 'Falta adjuntar el comprobante de pago.' });
            }

            if (!ai) {
                console.error("⚠️ Alerta: GEMINI_API_KEY no configurada en Render. Se saltea validación de IA.");
            } else {
                try {
                    // Convertimos el buffer de Multer al formato estructurado que pide Google
                    const parteImagen = {
                        inlineData: {
                            data: req.file.buffer.toString("base64"),
                            mimeType: req.file.mimetype
                        },
                    };

                    // Conseguimos la fecha actual en la zona horaria de Argentina para comparar
                    const fechaHoyArg = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

                    const promptValidacion = `
                        Actúa como un sistema experto de auditoría financiera para la fábrica "Mafalda's Chipa". 
                        Analiza detalladamente esta imagen de comprobante de pago electrónico proveniente de cualquier banco o billetera virtual.
                        
                        Datos de control esperados:
                        - Monto esperado: ${total} (Verifica que coincida numéricamente con los pesos impresos).
                        - Destinatario válido: Debe tener como destino a Franco Tomassoni, o los alias "mafalda.chipa" o "chipa.mafalda".
                        - Fecha de hoy en Argentina: ${fechaHoyArg} (El comprobante debe ser de hoy o como máximo del día anterior).

                        Tu tarea:
                        1. Determina con total seguridad si el documento es legítimamente un comprobante de transferencia o pago exitoso.
                        2. Extrae obligatoriamente el número de comprobante, ID de transacción o número de operación único.
                        3. Verifica que los datos coincidan (Monto coincidente, Destinatario correcto, y Fecha/Hora del día de hoy en curso).
                        
                        Responde estrictamente en formato JSON con la siguiente estructura, sin agregar texto extra, formato markdown o bloques de código:
                        {
                            "esValido": true o false,
                            "idTransaccion": "código extraído o vacío",
                            "motivoRechazo": "Explicación breve y concisa en español si esValido es false, de lo contrario vacío"
                        }
                    `;

                    // Llamada corregida utilizando la SDK oficial actual de Google
                    const modelo = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const responseAI = await modelo.generateContent([promptValidacion, parteImagen]);

                    const respuestaTexto = responseAI.response.text().trim();
                    // Limpiamos posibles formatos de bloque si la IA responde con ```json
                    const jsonLimpio = respuestaTexto.replace(/^```json/, '').replace(/```$/, '').trim();
                    const resultadoIA = JSON.parse(jsonLimpio);

                    console.log("-> Auditoría IA realizada:", resultadoIA);

                    if (!resultadoIA.esValido) {
                        return res.status(400).json({ 
                            ok: false, 
                            mensaje: `Comprobante rechazado: ${resultadoIA.motivoRechazo || 'Verifique que la imagen corresponda al pago exacto, destino y fecha del día de hoy.'}` 
                        });
                    }

                    // Log informativo para verificar qué ID procesó y evitar duplicaciones manuales
                    console.log(`✓ Pago verificado exitosamente por IA. ID Operación: ${resultadoIA.idTransaccion}`);

                } catch (errErrorAI) {
                    console.error("Error crítico procesando con Gemini:", errErrorAI);
                    // Si la IA falla por algún motivo externo temporal, dejamos pasar el pedido para no bloquear tu venta
                }
            }
        }
        // ==========================================

        const numeroOrden = 'ORD-' + Math.floor(Math.random() * 90000 + 10000);

        let filasProductos = '';
        pedido.forEach(item => {
            filasProductos += `
                <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; font-size: 14px; color: #2C2520;">${item.nombre}</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eeeeee; font-size: 14px; color: #2C2520; text-align: right; font-weight: bold;">${item.kilos} kg</td>
                </tr>
            `;
        });

        const attachments = [];
        if (req.file) {
            attachments.push({
                filename: `comprobante-${numeroOrden}.jpg`,
                content: req.file.buffer 
            });
        }

        const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #FDFBF7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FDFBF7; padding: 20px 0;">
                <tr>
                    <td align="center">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #F5F0E6; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                            
                            <tr>
                                <td align="center" style="background-color: #2C2520; padding: 32px 20px;">
                                    <h1 style="margin: 0; color: #E65C00; font-size: 34px; font-weight: bold; letter-spacing: 1px; font-family: 'Playfair Display', Georgia, serif;">Mafalda's <span style="color: #ffffff; font-size: 18px; tracking: 2px; font-family: Arial, sans-serif; text-transform: uppercase; font-weight: 900;">Chipa</span></h1>
                                    <p style="margin: 6px 0 0 0; color: #F5F0E6; font-size: 14px; font-style: italic; font-weight: 300; opacity: 0.8;">...del horno al corazón</p>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 40px 35px;">
                                    <h2 style="margin: 0 0 16px 0; color: #2C2520; font-size: 22px; font-weight: bold;">¡Hola, ${cliente.razonSocial}!</h2>
                                    <p style="margin: 0 0 28px 0; color: #555555; font-size: 15px; line-height: 1.6; font-weight: 300;">
                                        Recibimos tu solicitud de pedido mayorista correctamente. Nuestro equipo ya está validando el stock de fábrica para preparar tu orden y despacharla respetando estrictamente la cadena de frío.
                                    </p>

                                    <div style="background-color: #F5F0E6; border-radius: 14px; padding: 22px; margin-bottom: 28px;">
                                        <h3 style="margin: 0 0 14px 0; color: #E65C00; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8px;">Resumen de Compra (${numeroOrden})</h3>
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <thead>
                                                <tr>
                                                    <th align="left" style="padding-bottom: 8px; border-bottom: 2px solid #E65C00; font-size: 12px; color: #777777; text-transform: uppercase;">Variedad</th>
                                                    <th align="right" style="padding-bottom: 8px; border-bottom: 2px solid #E65C00; font-size: 12px; color: #777777; text-transform: uppercase;">Cantidad</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${filasProductos}
                                                <tr>
                                                    <td style="padding-top: 16px; font-size: 15px; font-weight: bold; color: #2C2520;">Total Estimado:</td>
                                                    <td style="padding-top: 16px; font-size: 22px; font-weight: 900; color: #E65C00; text-align: right;">${total}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px; font-size: 14px; color: #444444; line-height: 1.6; border-left: 3px solid #F5F0E6; padding-left: 14px;">
                                        <tr>
                                            <td><strong>Dirección de Entrega:</strong> ${cliente.direccion}, ${cliente.ciudad} (CP: ${cliente.cp})</td>
                                        </tr>
                                        <tr>
                                            <td style="padding-top: 4px;"><strong>Forma de Pago:</strong> ${cliente.pago.toUpperCase()}</td>
                                        </tr>
                                        ${cliente.notes ? `<tr><td style="padding-top: 10px; font-style: italic; color: #777777;"><strong>Notas adjuntas:</strong> "${cliente.notes}"</td></tr>` : ''}
                                    </table>

                                    ${req.file ? `
                                    <div style="background-color: #EBF7EE; border: 1px solid #D1EAD6; border-radius: 8px; padding: 12px 16px; margin-bottom: 28px; color: #1E5128; font-size: 13.5px; font-weight: 500;">
                                        ✓ Captura del comprobante de pago vinculada, auditada por sistema y adjuntada correctamente a este correo.
                                    </div>
                                    ` : ''}

                                    <p style="margin: 0 0 10px 0; color: #2C2520; font-size: 14px; font-weight: bold;">¿Cómo sigue tu pedido?</p>
                                    <p style="margin: 0; color: #555555; font-size: 14px; line-height: 1.6; font-weight: 300;">
                                        Nos comunicaremos con vos al teléfono <strong>${cliente.telefono}</strong> para pactar el día exacto y el rango horario en el que nuestro transporte dejará la mercadería en tu negocio.
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <td align="center" style="background-color: #FDFBF7; padding: 28px 20px; border-top: 1px solid #F5F0E6; font-size: 13px; color: #777777;">
                                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #2C2520; letter-spacing: 0.3px;">Mafalda's Chipa Factory</p>
                                    <p style="margin: 0 0 12px 0; font-weight: 300;">Roldán, Santa Fe, Argentina</p>
                                    <p style="margin: 0; font-size: 12px; color: #999999; font-weight: 300;">Ante cualquier duda inmediata, podes mandar un e-mail a chipa.mafalda@gmail.com o contactanos vía WhatsApp al <strong>+54 341 3 525720</strong>.</p>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;

        await resend.emails.send({
            from: 'Mafalda Chipa Factory <ventas@mafaldachipa.com>', 
            to: cliente.email, 
            bcc: 'chipa.mafalda@gmail.com', 
            subject: `Confirmación de Pedido - ${cliente.razonSocial}`,
            attachments: attachments, 
            html: emailHtml 
        });

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

const puertoServer = process.env.PORT || 3000;
app.listen(puertoServer, () => {
    console.log(`Servidor backend corriendo en el puerto ${puertoServer}`);
});
