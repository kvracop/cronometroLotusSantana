// ===== ESTADO =====
let segundosRestantes = 0;
let intervalo = null;
let fase = "luta"; // "luta" ou "descanso"
let rodadaAtual = 1;
let rodadaTotal = 5;
let tempoLutaSegundos = 3 * 60;
let tempoDescansoSegundos = 60;
let pausado = false;

// controla se já tocamos o aviso naquele segundo específico
// (evita repetir o som caso atualizarTela seja chamado mais de uma vez no mesmo segundo)
let ultimoSegundoApitado = null;

// ===== ELEMENTOS =====
const elCronometro = document.getElementById("cronometro");

const selectTempoLuta = document.getElementById("tempoLuta");
const inputTempoLutaCustom = document.getElementById("tempoLutaCustom");
const inputTempoDescansoCustom = document.getElementById("tempoDescansoCustom");
const inputNumRodadas = document.getElementById("numRodadas");

const botaoMenu = document.getElementById("botaoMenu");
const overlayMenu = document.getElementById("overlayMenu");
const painelMenu = document.getElementById("painelMenu");
const botaoAlterar = document.getElementById("botaoAlterar");

// ===== MENU FLUTUANTE =====
function alternarMenu() {
    const aberto = painelMenu.classList.contains("aberto");
    if (aberto) {
        fecharMenu();
    } else {
        abrirMenu();
    }
}

function abrirMenu() {
    painelMenu.classList.add("aberto");
    overlayMenu.classList.add("ativo");
}

function fecharMenu() {
    painelMenu.classList.remove("aberto");
    overlayMenu.classList.remove("ativo");
}

// ===== AVISO DE ALTERAÇÃO PENDENTE =====
// mostra o botão "Alterar" sempre que o usuário mexer em algum dos campos
// de configuração, sinalizando que é preciso aplicar a mudança
function mostrarAvisoAlteracao() {
    botaoAlterar.classList.add("visivel");
}

function esconderAvisoAlteracao() {
    botaoAlterar.classList.remove("visivel");
}

// aplica as novas configurações (mesma lógica do Zerar) e esconde o aviso
function aplicarAlteracao() {
    zerar();
    esconderAvisoAlteracao();
}

// quando o usuário escolhe "Personalizado" no select, habilita o campo customizado
selectTempoLuta.addEventListener("change", function () {
    if (selectTempoLuta.value === "custom") {
        inputTempoLutaCustom.disabled = false;
        inputTempoLutaCustom.focus();
    } else {
        inputTempoLutaCustom.disabled = true;
    }
    mostrarAvisoAlteracao();
});

inputTempoLutaCustom.addEventListener("input", mostrarAvisoAlteracao);
inputTempoDescansoCustom.addEventListener("input", mostrarAvisoAlteracao);
inputNumRodadas.addEventListener("input", mostrarAvisoAlteracao);

// estado inicial: campo customizado desabilitado (já que o select começa em "3")
inputTempoLutaCustom.disabled = true;

// ===== ÁUDIO (BIPES SIMPLES) =====
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Toca um único tom simples
function tocarTom(duracao, frequencia, volume, tipoOnda = "sine") {
    try {
        const ctx = getAudioCtx();
        const agora = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = tipoOnda;
        osc.frequency.setValueAtTime(frequencia, agora);

        const ganho = ctx.createGain();
        ganho.gain.setValueAtTime(0, agora);
        ganho.gain.linearRampToValueAtTime(volume, agora + 0.015);
        ganho.gain.linearRampToValueAtTime(volume, agora + duracao - 0.02);
        ganho.gain.linearRampToValueAtTime(0, agora + duracao);

        osc.connect(ganho);
        ganho.connect(ctx.destination);

        osc.start(agora);
        osc.stop(agora + duracao);
    } catch (e) {
        console.warn("Não foi possível tocar o som:", e);
    }
}

// Bipe curto e simples, um por segundo durante a contagem final (5,4,3,2,1)
const DURACAO_BIPE_CURTO = 0.15;
function bipeContagem() {
    tocarTom(DURACAO_BIPE_CURTO, 880, 0.5, "square");
}

// Bipe longo quando a fase termina (chega a 0) — mais forte e mais demorado
const DURACAO_BIPE_LONGO = 0.7;
function bipeFinal() {
    tocarTom(DURACAO_BIPE_LONGO, 880, 0.55, "square");
}

// ===== VOZ (TEXTO-PARA-VOZ, FEMININA E FIRME) =====
let vozFeminina = null;

function carregarVozes() {
    if (!("speechSynthesis" in window)) return;

    const vozes = window.speechSynthesis.getVoices();
    if (!vozes || vozes.length === 0) return;

    // tenta achar uma voz feminina em português primeiro
    const vozesPtBr = vozes.filter(v => v.lang && v.lang.toLowerCase().startsWith("pt"));
    const candidatas = vozesPtBr.length > 0 ? vozesPtBr : vozes;

    // heurística: nomes que normalmente indicam voz feminina nas vozes do sistema
    const nomesFemininos = /female|mulher|feminina|maria|luciana|joana|camila|vitória|vitoria|fernanda|raquel/i;

    vozFeminina =
        candidatas.find(v => nomesFemininos.test(v.name)) ||
        vozesPtBr[0] ||
        vozes[0];
}

if ("speechSynthesis" in window) {
    carregarVozes();
    // em vários navegadores a lista de vozes só fica disponível depois desse evento
    window.speechSynthesis.onvoiceschanged = carregarVozes;
}

function falar(texto) {
    try {
        if (!("speechSynthesis" in window)) return;

        window.speechSynthesis.cancel(); // evita acumular falas

        const utter = new SpeechSynthesisUtterance(texto);
        utter.lang = "pt-BR";

        if (vozFeminina) {
            utter.voice = vozFeminina;
        }

        // voz firme: ritmo levemente mais lento e tom levemente mais grave
        // que o padrão, para transmitir firmeza em vez de tom robótico/agudo
        utter.rate = 0.95;
        utter.pitch = 0.85;
        utter.volume = 1;

        window.speechSynthesis.speak(utter);
    } catch (e) {
        console.warn("Não foi possível usar a fala:", e);
    }
}

// ===== ATUALIZAÇÃO DE TELA =====
function formatarTempo(seg) {
    let horas = Math.floor(seg / 3600);
    let minutos = Math.floor((seg % 3600) / 60);
    let s = seg % 60;
    return String(horas).padStart(2, '0') + ":" +
           String(minutos).padStart(2, '0') + ":" +
           String(s).padStart(2, '0');
}

function atualizarTela() {
    elCronometro.textContent = formatarTempo(segundosRestantes);

    elCronometro.classList.remove("luta", "descanso", "alerta");

    let classeCor = fase; // "luta" ou "descanso"

    // últimos 10 segundos da fase atual -> vermelho
    if (segundosRestantes <= 10 && segundosRestantes > 0) {
        classeCor = "alerta";
    }

    elCronometro.classList.add(classeCor);
}

// toca um bipe simples a cada segundo nos últimos 5 segundos da fase (5,4,3,2,1)
function checarBipeContagem() {
    if (segundosRestantes <= 5 && segundosRestantes >= 1) {
        if (ultimoSegundoApitado !== segundosRestantes) {
            bipeContagem();
            ultimoSegundoApitado = segundosRestantes;
        }
    }
}

// ===== CONTROLE DO CRONÔMETRO =====
function lerConfiguracoes() {
    // tempo de luta: predefinido ou personalizado
    if (selectTempoLuta.value === "custom") {
        const minutosCustom = parseFloat(inputTempoLutaCustom.value);
        tempoLutaSegundos = minutosCustom > 0 ? Math.round(minutosCustom * 60) : 3 * 60;
    } else {
        tempoLutaSegundos = parseInt(selectTempoLuta.value) * 60;
    }

    // tempo de descanso: sempre editável
    const minutosDescanso = parseFloat(inputTempoDescansoCustom.value);
    tempoDescansoSegundos = minutosDescanso > 0 ? Math.round(minutosDescanso * 60) : 60;

    rodadaTotal = parseInt(inputNumRodadas.value) || 1;
}

function bloquearCampos(bloquear) {
    selectTempoLuta.disabled = bloquear;
    inputTempoLutaCustom.disabled = bloquear || selectTempoLuta.value !== "custom";
    inputTempoDescansoCustom.disabled = bloquear;
    inputNumRodadas.disabled = bloquear;
}

function iniciar() {
    if (intervalo != null) return; // já está rodando

    if (!pausado) {
        // começo do zero (primeira vez ou depois de zerar)
        lerConfiguracoes();
        fase = "luta";
        rodadaAtual = 1;
        segundosRestantes = tempoLutaSegundos;
        ultimoSegundoApitado = null;
    }

    pausado = false;
    bloquearCampos(true);
    fecharMenu();

    atualizarTela();

    // momento de referência: a partir de agora, segundosRestantes deve cair
    // exatamente 1 por segundo real transcorrido (evita acúmulo de atraso
    // do setInterval, que não é garantido ser exatamente 1000ms a cada chamada)
    let referenciaTempo = Date.now();
    let segundosNoInicioDoTick = segundosRestantes;

    intervalo = setInterval(function () {
        const decorrido = (Date.now() - referenciaTempo) / 1000;
        const novoRestante = Math.max(0, segundosNoInicioDoTick - Math.floor(decorrido));

        if (novoRestante !== segundosRestantes) {
            segundosRestantes = novoRestante;

            if (segundosRestantes <= 0) {
                mudarFase();

                // se o treino acabou, finalizarTudo() já limpou o intervalo;
                // só reinicia a referência se ainda estivermos rodando
                if (intervalo != null) {
                    referenciaTempo = Date.now();
                    segundosNoInicioDoTick = segundosRestantes;
                }
            } else {
                checarBipeContagem();
                atualizarTela();
            }
        }

    }, 200); // checa 5x por segundo para não perder a virada exata do segundo
}

function mudarFase() {
    ultimoSegundoApitado = null;

    if (fase === "luta") {
        // terminou a luta
        if (rodadaAtual >= rodadaTotal) {
            // era a última rodada -> acabou tudo
            bipeFinal();
            finalizarTudo();
            return;
        }

        fase = "descanso";
        segundosRestantes = tempoDescansoSegundos;
        bipeFinal();
        setTimeout(() => falar("Descansar"), DURACAO_BIPE_LONGO * 1000 + 150);
        atualizarTela();

    } else {
        // terminou o descanso -> próxima rodada de luta
        rodadaAtual++;
        fase = "luta";
        segundosRestantes = tempoLutaSegundos;
        bipeFinal();
        setTimeout(() => falar("Lutar"), DURACAO_BIPE_LONGO * 1000 + 150);
        atualizarTela();
    }
}

function finalizarTudo() {
    clearInterval(intervalo);
    intervalo = null;
    pausado = false;

    elCronometro.textContent = "00:00:00";
    elCronometro.classList.remove("luta", "descanso");
    elCronometro.classList.add("alerta");

    bloquearCampos(false);
}

function pausar() {
    if (intervalo == null) return;

    clearInterval(intervalo);
    intervalo = null;
    pausado = true;
}

function zerar() {
    clearInterval(intervalo);
    intervalo = null;
    pausado = false;

    if (window.speechSynthesis) window.speechSynthesis.cancel();

    fase = "luta";
    rodadaAtual = 1;
    ultimoSegundoApitado = null;

    lerConfiguracoes();
    segundosRestantes = tempoLutaSegundos;

    bloquearCampos(false);

    esconderAvisoAlteracao();

    atualizarTela();
}

// ===== INICIALIZAÇÃO =====
lerConfiguracoes();
segundosRestantes = tempoLutaSegundos;
atualizarTela();
