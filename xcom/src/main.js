import './style.css';
import { App } from './ui/app.js';

const app = new App(document.getElementById('app'));
// #quick launches a battle straight away (handy for development)
if (location.hash.startsWith('#quick')) app.launch();
else app.start();
window.__xcom = app;
