// ============================================================
//  CONFIGURACIÓN EMAILJS
//  1. Crea una cuenta en https://www.emailjs.com (gratis)
//  2. Crea un "Email Service" (Gmail, Outlook, etc.)
//  3. Crea un "Email Template" con las variables:
//       {{nombre}}, {{email}}, {{mensaje}}
//  4. Sustituye las 3 constantes de abajo con tus datos reales
// ============================================================


const btn = document.getElementById('button');

document.getElementById('form')
 .addEventListener('submit', function(event) {
   event.preventDefault();

   btn.value = 'Sending...';

   const serviceID = 'default_service';
   const templateID = 'template_pb880xb';

   emailjs.sendForm(serviceID, templateID, this)
    .then(() => {
      btn.value = 'Send Email';
      alert('Sent!');
    }, (err) => {
      btn.value = 'Send Email';
      alert(JSON.stringify(err));
    });
});