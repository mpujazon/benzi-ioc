//Variables globals.
var map;
var benzineries = [];
var coordIOC = L.latLng([41.37478,2.168292]);
var icones = {
    benzIcon : L.icon({
        iconUrl: '../img/icona_benzineria.png',
        iconSize: [45, 45],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
    }),
    iocIcon : L.icon({
        iconUrl: '../img/ioc.png',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
    })
};

// Quan carrega el DOM, es crida a l'API per emmagatzemar les dades de les benzineries i es carrega el mapa de Leaflet.
$(document).ready(function () {
    apiBenzineries();
    carregaLeaflet();

    //Creació d'events
    $("#cercador-cp").submit(function (e) { 
        e.preventDefault();
        cercaCP();
    });
    $(".localitzacio").click(geolocalitza);
})

///Funcions inicials
function carregaLeaflet() {
    // Carreguem el mapa amb la ubicació del IOC per defecte.
    map = L.map('map').setView(coordIOC,16);
    restablirPagina();
    map.on('click', onMapClick);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
}
function apiBenzineries(){
    // Carreguem les dades de les benzineries de Catalunya mitjançant l'API del govern d'Espanya i les desem a l'array "benzineries".
    $.ajax({
        type: "GET",
        // FiltroCCAA/09 (Catalunya)
        url: "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroCCAA/09",
        dataType: "json",
        success: tractamentDades
    });
}
// Es tracten i s'emmagatzemen les dades necessàries.
function tractamentDades(response, statusText, jqXHR) {
    for(resultat of response.ListaEESSPrecio){
        let novaBenzineria = {
            nom: resultat["Rótulo"],
            cp: resultat["C.P."],
            municipi: resultat.Municipio,
            direccio: resultat["Dirección"],
            horari: resultat.Horario,
            latlng: L.latLng([formatFloat(resultat.Latitud), formatFloat(resultat["Longitud (WGS84)"])]), 
            distancia: 0,
            preus: {
                "GLP": formatFloat(resultat["Precio Gases licuados del petróleo"]),
                "Gasoil A": formatFloat(resultat["Precio Gasoleo A"]),
                "Gasoil B": formatFloat(resultat["Precio Gasoleo B"]),
                "Gasoil Premium": formatFloat(resultat["Precio Gasoleo Premium"]),
                "Gasolina 95 E10": formatFloat(resultat["Precio Gasolina 95 E10"]),
                "Gasolina 95 E5": formatFloat(resultat["Precio Gasolina 95 E5"]),
                "Gasolina 95 E5 Premium": formatFloat(resultat["Precio Gasolina 95 E5 Premium"]),
                "Gasolina 98 E10": formatFloat(resultat["Precio Gasolina 98 E10"]),
                "Gasolina 98 E5": formatFloat(resultat["Precio Gasolina 98 E5"])
            }
        };
        benzineries.push(novaBenzineria);
    }
    // Un cop es carreguen les dades es cerquen les 10 benzineries més properes al punt inicial.
    cercaPropera(coordIOC);
}

///FUNCIONS d'obtenció de coordenades:
function onMapClick(e) {
    // Quan es clica en el mapa crea un marker, s'obtenen les coordenades i crida a la funció cercaPropera(coord).
    restablirPagina();
    var puntTriat = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
    cercaPropera(e.latlng);
}

//Demana la ubicació de l'usuari i crida a la funció cercaPropera(coord).
function geolocalitza() {
    if (navigator.geolocation) {
        // Si el navegador soporta geolocalització.
        navigator.geolocation.getCurrentPosition(function(position) {
            // Si s'obté la ubicació de l'usuari es cerquen els 10 resultats més propers.
            let coordUsuari = L.latLng([position.coords.latitude,position.coords.longitude]);
            restablirPagina();
            cercaPropera(coordUsuari);            
        }, function(error) {
            console.error("Error al obtenir la ubicació:", error);
        });
    } else {
        console.error("El teu navegador no soporta la geolocalització.");
    }
}

///FUNCIONS de cerca i mostra de resultats:
function cercaPropera(coord) {
    // Desa els resultats a menys de 30km i els ordena per distància.
    let distanciaMax = 30000; //En metres
    let bounds = new L.LatLngBounds();
    let benzineriesProperes = [];

    for (benzineria of benzineries){
        let coordBenzineria = benzineria.latlng;
        let distancia = coord.distanceTo(coordBenzineria);
        if(distancia <= distanciaMax){
            benzineriesProperes.push({...benzineria, distancia: distancia})
        }
    }

    benzineriesProperes.sort((a, b) => a.distancia - b.distancia);

    for(let i = 0; i<(Math.min(10, benzineriesProperes.length)); i++){
        var marker = L.marker([benzineriesProperes[i].latlng.lat,benzineriesProperes[i].latlng.lng], {icon: icones.benzIcon}).addTo(map);
            marker.bindPopup("<b>"+benzineriesProperes[i].nom+"</b><br>"+"<span>"+benzineriesProperes[i].direccio+"</span><br>"+"<span>A "+ parseInt(benzineriesProperes[i].distancia)+ " metres de distància</span>");
            //////
            bounds.extend(marker.getLatLng());
            mostraResultats(benzineriesProperes[i]);       
    }
    if (benzineriesProperes.length > 0){
        map.fitBounds(bounds, { padding: [90, 90] });
    }else{
        alert("Cap resultat a menys de 30km de l'ubicació donada.")
    }
}

function cercaCP() {
    // Cerca i mostra els resultats que coincideixen amb el CP donat.
    restablirPagina();
    let bounds = new L.LatLngBounds();
    let existeixenResultats = false;
    let cp = $("#inputCP").val();
    for (benzineria of benzineries){
        if (benzineria.cp === cp){
            var marker = L.marker([benzineria.latlng.lat, benzineria.latlng.lng], {icon: icones.benzIcon}).addTo(map);
            marker.bindPopup("<b>"+benzineria.nom+"</b><br>"+"<span>"+benzineria.direccio+"</span><br>"+"<span>A "+ parseInt(benzineria.distancia)+ " metres de distància</span>");
            bounds.extend(marker.getLatLng());
            existeixenResultats = true;
            mostraResultats(benzineria);
        }
    }
    if (existeixenResultats) {
        map.fitBounds(bounds, { padding: [90, 90] });
    }else{
        $("#inputCP").val("");
        alert("Sense resultats, prova amb un altre codi postal!")
    }
}

function mostraResultats(benzineria) {
    let contenidorResultats = $("#resultats");
    $(contenidorResultats).append(creaBenzineriaHTML(benzineria));
}

function creaBenzineriaHTML(benzineria) {
    // Variable para almacenar el HTML generado
    var html = `
        <div class="benzineria col-md-6 col-lg-4 mb-4">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${benzineria.nom}</h5>
                    <p class="card-text">${benzineria.municipi}</p>
                    <p class="card-text">${benzineria.direccio}</p>
                    <p class="card-text">${benzineria.horari}</p>
                    <p class="card-text">A ${parseInt(benzineria.distancia)} metres de distància</p>
                    <ul class="list-group list-group-flush">
    `;
    // Bucle para añadir productos solo si existe la propiedad y cumple una condición
    let hiHaPreus = false;
    for (let producte in benzineria.preus) {
        let preu = benzineria.preus[producte];
        if (preu > 0) {
            html += `<li class="list-group-item">${producte}: ${preu} €/l</li>`;
            hiHaPreus = true;
        }
    }
    if (!hiHaPreus) {
        html += `<li class="list-group-item">Sense informació de preus</li>`;
    }
    // Cierre del HTML
    html += `</ul>
                </div>
                <div class="card-footer text-center">
                    <button class="btn btn-primary" coord="${benzineria.latlng.lat},${benzineria.latlng.lng}" onclick="rutaBenzineria(this)">Com anar-hi</button>
                </div>
            </div>
        </div>`;

    return html;
}
//Obre la ruta a la benzineria a Google Maps.
function rutaBenzineria(button) {
    let coordenadesBenzineria = button.getAttribute("coord");
    if (coordenadesBenzineria) {
        var url = "https://www.google.com/maps/dir//" + coordenadesBenzineria;
        window.open(url, "_blank");
    }
}

//Altres FUNCIONS:
function restablirPagina() {
    // Esborra resultats anteriors, tant del mapa com de la pàgina.
    map.eachLayer(function(layer) {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    var marcadorIOC = L.marker(coordIOC, {icon: icones.iocIcon}).addTo(map);
    netejaContenidorResultats();
}
//Esborra els resultats creats dinàmicament fins ara.
function netejaContenidorResultats() {
    $("#resultats").empty();
}
// Canvia les "," per "." i retorna un Float.
function formatFloat(string) {
    return parseFloat(string.replace(/,/g, '.'));
}
