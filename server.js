const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DE RESEND (Pegá acá tu clave de desarrollo de resend.com)
const resend = new Resend('re_i9fDNs1y_BGNX2YABPXtWuQDCFB7AnVf2');

app.post('/api/pedido', async (req, res) => {
    const { cliente, pedido, total } = req.body;

    if (!cliente || !pedido || pedido.length === 0) {
        return res.status(400).json({ ok: false, mensaje: 'Datos del pedido incompletos.' });
    }

    // Armamos el detalle de los productos en HTML
    let detalleHtml = '';
    pedido.forEach(item => {
        detalleHtml += `<li><strong>${item.nombre}</strong>: ${item.kilos} kg</li>`;
    });

    try {
        // ENVIAMOS EL CORREO (Ahora sí, usando tu dominio propio)
        await resend.emails.send({
            // 1. ACÁ PONÉS TU MAIL REAL CON TU DOMINIO:
            from: 'Pedidos Mafalda <hola@mafaldachipa.com>', 
            
            // 2. ACÁ LE LLEGA DIRECTO AL CLIENTE (usando la variable de su formulario):
            to: cliente.email, 
            
            // 3. ACÁ TE PONÉS A VOS EN COPIA OCULTA (así te entra el aviso al instante):
            bcc: 'chipa.mafalda@gmail.com', 
            
            subject: `Confirmación de Pedido - ${cliente.razonSocial}`,
            html: `
                <h2>¡Hola ${cliente.razonSocial}! Recibimos tu pedido correctamente.</h2>
                <p>Muchas gracias por comprar en <strong>Mafalda's Chipa Factory</strong>. Acá tenés el resumen de tu solicitud:</p>
                <hr>
                <p><strong>Dirección de Entrega:</strong> ${cliente.direccion}, ${cliente.ciudad} (CP: ${cliente.cp})</p>
                <p><strong>Forma de Pago elegida:</strong> ${cliente.pago}</p>
                ${cliente.notes ? `<p><strong>Notas temporales:</strong> ${cliente.notes}</p>` : ''}
                <hr>
                <h3>Detalle de tu Compra:</h3>
                <ul>${detalleHtml}</ul>
                <h3>Total Estimado: ${total}</h3>
                <br>
                <p>Nos vamos a estar comunicando con vos al número <strong>${cliente.telefono}</strong> para coordinar el día y horario de la entrega.</p>
                <p>Saludos cordiales,</p>
                <h4>El equipo de Mafalda's</h4>
            `
        });

        // Generamos el número de orden ficticio para responderle a la pantalla del navegador
        const numeroOrden = 'ORD-' + Math.floor(Math.random() * 90000 + 10000);
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

// Esto permite que use el puerto de internet, o el 3000 si estás en tu PC
const puertoServer = process.env.PORT || 3000;

app.listen(puertoServer, () => {
    console.log(`Servidor backend corriendo en el puerto ${puertoServer}`);
});
