let segundos = 0;

let intervalo = null;

function atualizar(){

    let horas = Math.floor(segundos / 3600);

    let minutos = Math.floor((segundos % 3600) / 60);

    let seg = segundos % 60;

    document.getElementById("cronometro").innerHTML =
        String(horas).padStart(2,'0') + ":" +
        String(minutos).padStart(2,'0') + ":" +
        String(seg).padStart(2,'0');

}

function iniciar(){

    if(intervalo != null)
        return;

    intervalo = setInterval(function(){

        segundos++;

        atualizar();

    },1000);

}

function pausar(){

    clearInterval(intervalo);

    intervalo = null;

}

function zerar(){

    pausar();

    segundos = 0;

    atualizar();

}

atualizar();