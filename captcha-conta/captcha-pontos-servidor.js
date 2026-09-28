const crypto = require('crypto');
module.exports = function criarCaptchaPontos({ validarInitDataTelegram, usuarioLiberadoPorId, salvarUsuarioTelegram, obterPeriodoDiarioAtual }) {
    const ativo = process.env.CAPTCHA_PONTOS_ATIVO !== 'false';
    const desafios = new Map();
    const validade = 120000;
    function novo(id, periodo) {
        const agora = Date.now();
        for (const [chave, item] of desafios) {
            if (item.expira <= agora) desafios.delete(chave);
        }
        if (desafios.size >= 10000 && !desafios.has(id)) return null;
        const a = crypto.randomInt(2, 20), b = crypto.randomInt(2, 20);
        const item = { id: crypto.randomBytes(24).toString('hex'), resposta: a + b,
            pergunta: `Quanto é ${a} + ${b}?`, periodo, expira: agora + validade, tentativas: 0 };
        desafios.set(id, item);
        return item;
    }
    function pedir(res, item, erro) {
        return res.status(428).json({ captchaNecessario: true, desafioId: item.id,
            pergunta: item.pergunta, erro: erro || 'Resolva a conta para girar.' });
    }
    return function captchaPontos(req, res, next) {
        if (!ativo) return next();
        res.set('Cache-Control', 'no-store');
        const validacao = validarInitDataTelegram(req.body?.initData);
        if (!validacao.ok) return res.status(401).json({ erro: 'Abra novamente pelo Telegram.' });
        const id = String(validacao.usuario.id);
        if (!usuarioLiberadoPorId(id)) return res.status(403).json({ erro: 'Esta conta não está habilitada.' });
        let usuario, periodo;
        try {
            usuario = salvarUsuarioTelegram(validacao.usuario);
            periodo = obterPeriodoDiarioAtual();
        } catch {
            return res.status(503).json({ erro: 'Não foi possível verificar seu giro agora.' });
        }
        if (usuario.ultimoPeriodoDiario === periodo) {
            desafios.delete(id);
            return next();
        }
        let item = desafios.get(id);
        if (!item || item.expira <= Date.now() || item.periodo !== periodo) {
            item = novo(id, periodo);
            if (!item) return res.status(503).json({ erro: 'Verificação ocupada. Tente novamente.' });
            return pedir(res, item, 'Resolva esta conta para continuar.');
        }
        if (!req.body?.desafioId) return pedir(res, item);
        if (req.body.desafioId !== item.id) return pedir(res, item, 'Use a conta atual.');
        const resposta = String(req.body.respostaCaptcha ?? '').trim();
        if (!/^\d{1,3}$/.test(resposta) || Number(resposta) !== item.resposta) {
            item.tentativas++;
            if (item.tentativas >= 3) item = novo(id, periodo);
            return pedir(res, item, 'Resposta incorreta. Tente novamente; seu giro não foi consumido.');
        }
        // Consome o desafio antes de encaminhar a requisição ao giro.
        desafios.delete(id);
        return next();
    };
};
