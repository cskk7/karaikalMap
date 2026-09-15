(function () {
  const surveyData = window.json_KaraikalSurveyBoundary_2;
  const villageData = window.json_KaraikalVillageBoundary_3;

  if (!surveyData || !villageData) {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div style="position:fixed;inset:16px;z-index:10;padding:16px;background:white;border:1px solid #d33">Boundary data did not load.</div>'
    );
    return;
  }

  const geoJson = new ol.format.GeoJSON();

  const satelliteLayer = new ol.layer.Tile({
    title: "Google Satellite",
    visible: true,
    source: new ol.source.XYZ({
      url: "https://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}",
      attributions: "Google Satellite"
    })
  });

  const osmLayer = new ol.layer.Tile({
    title: "OpenStreetMap",
    visible: false,
    source: new ol.source.OSM()
  });

  const surveySource = new ol.source.Vector({
    features: geoJson.readFeatures(surveyData, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    })
  });

  const villageSource = new ol.source.Vector({
    features: geoJson.readFeatures(villageData, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    })
  });

  const surveyLayer = new ol.layer.Vector({
    title: "Karaikal Survey Boundary",
    source: surveySource,
    style: function (feature, resolution) {
      return new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: "rgba(255, 214, 7, 1)",
          width: 3
        }),
        text: resolution < 6
          ? new ol.style.Text({
              text: String(feature.get("Khandam Nu") || ""),
              font: "19px Calibri, Arial, sans-serif",
              fill: new ol.style.Fill({ color: "#f72323" }),
              stroke: new ol.style.Stroke({ color: "rgba(255,255,255,0.8)", width: 3 })
            })
          : undefined
      });
    }
  });

  const villageLayer = new ol.layer.Vector({
    title: "Karaikal Village Boundary",
    source: villageSource,
    style: function (feature, resolution) {
      return new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: "rgba(47, 32, 210, 1)",
          width: 3
        }),
        text: resolution < 28
          ? new ol.style.Text({
              text: String(feature.get("Village") || ""),
              font: "22px Arial, sans-serif",
              fill: new ol.style.Fill({ color: "#1a17de" }),
              stroke: new ol.style.Stroke({ color: "rgba(255,255,255,0.85)", width: 4 })
            })
          : undefined
      });
    }
  });

  const map = new ol.Map({
    target: "map",
    layers: [satelliteLayer, osmLayer, surveyLayer, villageLayer],
    view: new ol.View({
      center: ol.proj.fromLonLat([79.82, 10.93]),
      zoom: 12,
      minZoom: 1,
      maxZoom: 28
    })
  });

  map.getView().fit(villageSource.getExtent(), {
    padding: [80, 30, 30, 390],
    duration: 250
  });

  const toolsPanel = document.getElementById("toolsPanel");
  const panelToggle = document.getElementById("panelToggle");
  const panelClose = document.getElementById("panelClose");

  function setToolsPanelOpen(isOpen) {
    toolsPanel.classList.toggle("collapsed", !isOpen);
    panelToggle.hidden = isOpen;
    panelToggle.setAttribute("aria-expanded", String(isOpen));
  }

  panelToggle.addEventListener("click", function () {
    setToolsPanelOpen(true);
  });

  panelClose.addEventListener("click", function () {
    setToolsPanelOpen(false);
  });

  setToolsPanelOpen(false);

  const popupEl = document.getElementById("popup");
  const popupContent = document.getElementById("popupContent");
  const popupCloser = document.getElementById("popupCloser");
  const popup = new ol.Overlay({
    element: popupEl,
    autoPan: { animation: { duration: 200 } },
    positioning: "bottom-left",
    offset: [0, -12]
  });
  map.addOverlay(popup);
  popupEl.style.display = "none";

  popupCloser.addEventListener("click", function () {
    popup.setPosition(undefined);
    popupEl.style.display = "none";
  });

  map.on("singleclick", function (event) {
    const hits = [];
    map.forEachFeatureAtPixel(event.pixel, function (feature, layer) {
      if (layer === surveyLayer || layer === villageLayer) {
        hits.push({ feature, layer });
      }
    });

    if (!hits.length) {
      popup.setPosition(undefined);
      popupEl.style.display = "none";
      return;
    }

    popupContent.innerHTML = hits.map(renderFeaturePopup).join("");
    popup.setPosition(event.coordinate);
    popupEl.style.display = "block";
  });

  function renderFeaturePopup(hit) {
    const title = hit.layer === surveyLayer ? "Karaikal Survey Boundary" : "Karaikal Village Boundary";
    const props = hit.feature.getProperties();
    const rows = Object.keys(props)
      .filter((key) => key !== "geometry")
      .map((key) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(props[key])}</td></tr>`)
      .join("");

    return `<article><h3>${title}</h3><table>${rows}</table></article>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  document.querySelectorAll('input[name="baseLayer"]').forEach((input) => {
    input.addEventListener("change", function () {
      satelliteLayer.setVisible(this.value === "satellite");
      osmLayer.setVisible(this.value === "osm");
    });
  });

  document.getElementById("villageLayerToggle").addEventListener("change", function () {
    villageLayer.setVisible(this.checked);
  });

  document.getElementById("surveyLayerToggle").addEventListener("change", function () {
    surveyLayer.setVisible(this.checked);
  });

  const villageNames = Array.from(
    new Set(villageSource.getFeatures().map((feature) => feature.get("Village")).filter(Boolean))
  ).sort();
  let selectedVillage = "";

  document.getElementById("villageList").innerHTML = villageNames
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");

  document.getElementById("featureSearchBtn").addEventListener("click", zoomToVillage);
  document.getElementById("featureSearch").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      zoomToVillage();
    }
  });

  function zoomToVillage() {
    const query = document.getElementById("featureSearch").value.trim().toLowerCase();
    if (!query) return;

    const feature = villageSource.getFeatures().find((candidate) => {
      return String(candidate.get("Village") || "").toLowerCase() === query;
    }) || villageSource.getFeatures().find((candidate) => {
      return String(candidate.get("Village") || "").toLowerCase().includes(query);
    });

    if (!feature) return;
    selectedVillage = String(feature.get("Village") || "");
    document.getElementById("featureSearch").value = selectedVillage;
    updateSurveySearchOptions();
    map.getView().fit(feature.getGeometry().getExtent(), {
      padding: [90, 40, 60, 390],
      duration: 500,
      maxZoom: 15
    });
  }

  document.getElementById("surveySearchBtn").addEventListener("click", zoomToSurveyNumber);
  document.getElementById("surveySearch").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      zoomToSurveyNumber();
    }
  });

  function updateSurveySearchOptions() {
    const surveyInput = document.getElementById("surveySearch");
    const surveyButton = document.getElementById("surveySearchBtn");
    const surveyList = document.getElementById("surveyList");
    const numbers = getSurveyFeaturesForSelectedVillage()
      .map((feature) => String(feature.get("Khandam Nu") || "").trim())
      .filter(Boolean)
      .sort(compareSurveyNumbers);

    surveyInput.value = "";
    surveyInput.disabled = !selectedVillage;
    surveyButton.disabled = !selectedVillage;
    surveyInput.placeholder = selectedVillage ? "Type survey number" : "Select village first";
    surveyList.innerHTML = numbers
      .map((number) => `<option value="${escapeHtml(number)}"></option>`)
      .join("");
  }

  function getSurveyFeaturesForSelectedVillage() {
    const village = selectedVillage.toLowerCase();
    if (!village) return [];
    return surveySource.getFeatures().filter((feature) => {
      return String(feature.get("Village") || "").toLowerCase() === village;
    });
  }

  function compareSurveyNumbers(left, right) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
    return left.localeCompare(right, undefined, { numeric: true });
  }

  function zoomToSurveyNumber() {
    const query = document.getElementById("surveySearch").value.trim().toLowerCase();
    if (!query || !selectedVillage) return;

    const feature = getSurveyFeaturesForSelectedVillage().find((candidate) => {
      return String(candidate.get("Khandam Nu") || "").toLowerCase() === query;
    }) || getSurveyFeaturesForSelectedVillage().find((candidate) => {
      return String(candidate.get("Khandam Nu") || "").toLowerCase().includes(query);
    });

    if (!feature) return;
    document.getElementById("surveySearch").value = String(feature.get("Khandam Nu") || "");
    surveyLayer.setVisible(true);
    document.getElementById("surveyLayerToggle").checked = true;
    map.getView().fit(feature.getGeometry().getExtent(), {
      padding: [90, 40, 60, 390],
      duration: 500,
      maxZoom: 19
    });
    popupContent.innerHTML = renderFeaturePopup({ feature, layer: surveyLayer });
    popup.setPosition(ol.extent.getCenter(feature.getGeometry().getExtent()));
    popupEl.style.display = "block";
  }

  updateSurveySearchOptions();

  document.getElementById("placeSearchForm").addEventListener("submit", function (event) {
    event.preventDefault();
    searchPlace();
  });

  async function searchPlace() {
    const query = document.getElementById("placeSearch").value.trim();
    if (!query) return;

    const endpoint = new URL("https://nominatim.openstreetmap.org/search");
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("limit", "1");
    endpoint.searchParams.set("q", query);

    const response = await fetch(endpoint.toString(), {
      headers: { "Accept": "application/json" }
    });
    const results = await response.json();
    if (!results.length) return;

    const lon = Number(results[0].lon);
    const lat = Number(results[0].lat);
    map.getView().animate({
      center: ol.proj.fromLonLat([lon, lat]),
      zoom: 15,
      duration: 500
    });
  }

  const measureSource = new ol.source.Vector();
  const measureLayer = new ol.layer.Vector({
    source: measureSource,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "#1257d8", width: 3, lineDash: [10, 8] }),
      fill: new ol.style.Fill({ color: "rgba(18, 87, 216, 0.16)" }),
      image: new ol.style.Circle({
        radius: 5,
        fill: new ol.style.Fill({ color: "#ffd607" }),
        stroke: new ol.style.Stroke({ color: "#1257d8", width: 2 })
      })
    })
  });
  map.addLayer(measureLayer);

  let drawInteraction = null;
  let measureTooltip = null;
  const measureOverlays = [];

  document.getElementById("measureLineBtn").addEventListener("click", function () {
    startMeasure("LineString", this);
  });
  document.getElementById("measureAreaBtn").addEventListener("click", function () {
    startMeasure("Polygon", this);
  });
  document.getElementById("clearMeasureBtn").addEventListener("click", clearMeasurements);

  function startMeasure(type, button) {
    stopMeasure();
    button.classList.add("active");
    drawInteraction = new ol.interaction.Draw({
      source: measureSource,
      type
    });
    map.addInteraction(drawInteraction);

    drawInteraction.on("drawstart", function (event) {
      measureTooltip = createMeasureTooltip();
      event.feature.getGeometry().on("change", function (changeEvent) {
        const geom = changeEvent.target;
        const output = geom instanceof ol.geom.Polygon ? formatArea(geom) : formatLength(geom);
        const coord = geom instanceof ol.geom.Polygon
          ? geom.getInteriorPoint().getCoordinates()
          : geom.getLastCoordinate();
        measureTooltip.element.innerHTML = output;
        measureTooltip.overlay.setPosition(coord);
      });
    });

    drawInteraction.on("drawend", function () {
      measureTooltip = null;
      stopMeasure();
    });
  }

  function stopMeasure() {
    document.querySelectorAll(".icon-button.active").forEach((button) => button.classList.remove("active"));
    if (drawInteraction) {
      map.removeInteraction(drawInteraction);
      drawInteraction = null;
    }
  }

  function clearMeasurements() {
    stopMeasure();
    measureSource.clear();
    measureOverlays.splice(0).forEach((overlay) => map.removeOverlay(overlay));
  }

  function createMeasureTooltip() {
    const element = document.createElement("div");
    element.className = "measure-tooltip";
    const overlay = new ol.Overlay({
      element,
      offset: [0, -12],
      positioning: "bottom-center"
    });
    map.addOverlay(overlay);
    measureOverlays.push(overlay);
    return { element, overlay };
  }

  function formatLength(line) {
    const length = ol.sphere.getLength(line, { projection: map.getView().getProjection() });
    return length > 1000
      ? `${Math.round((length / 1000) * 100) / 100} km`
      : `${Math.round(length * 100) / 100} m`;
  }

  function formatArea(polygon) {
    const area = ol.sphere.getArea(polygon, { projection: map.getView().getProjection() });
    return area > 1000000
      ? `${Math.round((area / 1000000) * 1000) / 1000} km<sup>2</sup>`
      : `${Math.round(area * 100) / 100} m<sup>2</sup>`;
  }

  const locateBtn = document.getElementById("locateBtn");
  const locationSource = new ol.source.Vector();
  const locationLayer = new ol.layer.Vector({
    source: locationSource,
    style: new ol.style.Style({
      image: new ol.style.Circle({
        radius: 7,
        fill: new ol.style.Fill({ color: "#3399cc" }),
        stroke: new ol.style.Stroke({ color: "#ffffff", width: 3 })
      })
    })
  });
  map.addLayer(locationLayer);

  locateBtn.addEventListener("click", function () {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (position) {
      const coordinate = ol.proj.fromLonLat([position.coords.longitude, position.coords.latitude]);
      locationSource.clear();
      locationSource.addFeature(new ol.Feature(new ol.geom.Point(coordinate)));
      map.getView().animate({ center: coordinate, zoom: 16, duration: 500 });
    });
  });
})();
