"use strict";
// Rewards the user with an attractive logo animation after a successful login.
window.onload = function() {
	let stLogo = document.getElementById("st-logo");
	let svgDoc = stLogo.contentDocument;
	let styleElement = svgDoc.createElementNS("http://www.w3.org/2000/svg", "style");
	styleElement.textContent = `
		g {
			fill: #ffffff;
			stroke: #ffffff;
			stroke-width: 0;
			animation-name: dashin;
    		animation-duration: 1s;
			animation-timing-function: linear;
		}
		@keyframes dashin {
			0%   { fill: rgba(255,255,255,0); stroke-width: 1; stroke-dasharray: 0, 1000; }
			95%  { fill: rgba(255,255,255,0); stroke-width: 1; stroke-dasharray: 500, 500; }
			98%  { stroke-width: 3; }
			100% { fill: rgba(255,255,255,1); stroke-width: 0; stroke-dasharray: 500, 0; }
		}`;
	svgDoc.getElementsByTagName("svg")[0].appendChild(styleElement);
};
