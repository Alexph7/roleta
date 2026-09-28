(() => {
    function perguntar(config) {
        return new Promise(resolve => {
            const modal = document.createElement('dialog');
            modal.className = 'captcha-pontos-modal';
            const form = document.createElement('form');
            const titulo = document.createElement('h2');
            titulo.textContent = 'Antes de girar';
            const aviso = document.createElement('p');
            aviso.textContent = config.erro || 'Resolva a conta para continuar.';
            const label = document.createElement('label');
            label.htmlFor = 'captcha-resposta';
            label.textContent = config.pergunta;
            const input = document.createElement('input');
            input.id = 'captcha-resposta';
            input.type = 'text';
            input.inputMode = 'numeric';
            input.pattern = '[0-9]{1,3}';
            input.maxLength = 3;
            input.required = true;
            input.autocomplete = 'off';
            const confirmar = document.createElement('button');
            confirmar.type = 'submit';
            confirmar.textContent = 'Confirmar e girar';
            const cancelar = document.createElement('button');
            cancelar.type = 'button';
            cancelar.textContent = 'Cancelar';
            cancelar.className = 'captcha-cancelar';
            form.append(titulo, aviso, label, input, confirmar, cancelar);
            modal.appendChild(form);
            document.body.appendChild(modal);
            let terminado = false;
            function terminar(valor) {
                if (terminado) return;
                terminado = true;
                modal.close(); modal.remove(); resolve(valor);
            }
            form.addEventListener('submit', event => { event.preventDefault(); terminar(input.value.trim()); });
            cancelar.onclick = () => terminar(null);
            modal.addEventListener('cancel', event => { event.preventDefault(); terminar(null); });
            modal.showModal();
            input.focus();
        });
    }
    window.girarPontosComCaptcha = async function(initData) {
        const enviar = (desafioId, respostaCaptcha) => fetch('/api/girar-pontos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, desafioId, respostaCaptcha })
        });
        let resposta = await enviar();
        while (resposta.status === 428) {
            const config = await resposta.clone().json();
            if (!config.captchaNecessario) return resposta;
            const valor = await perguntar(config);
            if (valor === null) return new Response(JSON.stringify({ erro: 'Verificação cancelada. Seu giro não foi consumido.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
            resposta = await enviar(config.desafioId, valor);
        }
        return resposta;
    };
})();
