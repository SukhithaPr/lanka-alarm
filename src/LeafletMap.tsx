import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { SRI_LANKA_BOUNDS as B } from './geo';
import type { LatLon } from './types';

export interface MapState {
  me: LatLon | null;
  dest: LatLon | null;
  radiusM: number;
  /** Road route if available, otherwise a straight dashed line is drawn. */
  route: [number, number][] | null;
  /** Bump to re-fit the camera. */
  fitKey: number;
}

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#m{height:100%;margin:0;background:#dfe6ee}.leaflet-control-attribution{font-size:9px}</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var bounds=L.latLngBounds([${B.south},${B.west}],[${B.north},${B.east}]);
var map=L.map('m',{zoomControl:false,maxBounds:bounds.pad(0.2),minZoom:7}).setView([7.8,80.7],7);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);
var me,dest,ring,line,lastFit=-1,centered=false;
function post(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))}
map.on('click',function(e){post({type:'tap',lat:e.latlng.lat,lon:e.latlng.lng})});
window.update=function(s){
  map.invalidateSize(); // the WebView can get its final size after the map is built
  if(me){map.removeLayer(me);me=null}
  if(dest){map.removeLayer(dest);dest=null}
  if(ring){map.removeLayer(ring);ring=null}
  if(line){map.removeLayer(line);line=null}
  if(s.me){me=L.circleMarker([s.me.lat,s.me.lon],{radius:8,color:'#fff',weight:3,fillColor:'#2f80ed',fillOpacity:1}).addTo(map)}
  if(s.dest){
    dest=L.circleMarker([s.dest.lat,s.dest.lon],{radius:9,color:'#fff',weight:3,fillColor:'#ff5a36',fillOpacity:1}).addTo(map);
    ring=L.circle([s.dest.lat,s.dest.lon],{radius:s.radiusM,color:'#ff5a36',weight:2,fillOpacity:0.12}).addTo(map);
    if(s.route){line=L.polyline(s.route,{color:'#2f80ed',weight:5,opacity:0.9}).addTo(map)}
    else if(s.me){line=L.polyline([[s.me.lat,s.me.lon],[s.dest.lat,s.dest.lon]],{color:'#2f80ed',weight:3,dashArray:'8 8'}).addTo(map)}
  }
  // First GPS fix with nothing chosen yet: open on the user, not the whole island.
  if(s.me&&!centered&&!s.dest&&bounds.contains([s.me.lat,s.me.lon])){centered=true;map.setView([s.me.lat,s.me.lon],14)}
  if(s.fitKey!==lastFit){
    lastFit=s.fitKey;
    var pts=[];if(s.me)pts.push([s.me.lat,s.me.lon]);if(s.dest)pts.push([s.dest.lat,s.dest.lon]);
    if(pts.length>1)map.fitBounds(pts,{padding:[60,60],maxZoom:15});
    else if(pts.length===1)map.setView(pts[0],14);
  }
};
post({type:'ready'});
</script></body></html>`;

interface Props {
  state: MapState;
  onTap: (p: LatLon) => void;
}

export default function LeafletMap({ state, onTap }: Props) {
  const ref = useRef<WebView>(null);
  const ready = useRef(false);

  const push = useCallback(() => {
    if (ready.current) ref.current?.injectJavaScript(`window.update(${JSON.stringify(state)});true;`);
  }, [state]);

  useEffect(push, [push]);

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = JSON.parse(e.nativeEvent.data);
    if (msg.type === 'ready') {
      ready.current = true;
      push();
    } else if (msg.type === 'tap') onTap({ lat: msg.lat, lon: msg.lon });
  };

  return (
    <WebView
      ref={ref}
      source={{ html: HTML, baseUrl: 'https://localhost' }}
      onMessage={onMessage}
      style={StyleSheet.absoluteFill}
      javaScriptEnabled
      originWhitelist={['*']}
      // Map tiles are the only thing it loads; block any navigation away.
      onShouldStartLoadWithRequest={(r) => r.url.startsWith('about:') || r.url.startsWith('https://localhost')}
    />
  );
}
