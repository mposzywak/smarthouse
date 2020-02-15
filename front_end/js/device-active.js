
function downShade(device) {
	let buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_direction';
	let position = '';
	
	if (typeof(device.position) != 'undefined')
		position = '(' + device.position + ')'
	$('#' + buttonID).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> going down...');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).attr("disabled", "disabled");
}

function upShade(device) {
	let buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_direction';
	let positionSliderID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_position_slider';
	let tiltSliderID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_position_slider';

	$('#' + buttonID).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> going up...');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).attr("disabled", "disabled");
}

function stopShade(device) {
	let buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_direction';
	
	$('#' + buttonID).html('<span role="status" aria-hidden="true"></span> stopped');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).attr("disabled", "disabled");
}

function unsyncShade(device) {
	let buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_direction';
	$('#' + buttonID).html('<span role="status" aria-hidden="true"></span> synchronize!');
	$('#' + buttonID).removeAttr("disabled", "disabled");
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).addClass('switch-button-on');
}

function enableTilt(device) {
	let sliderID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_tilt_slider';
	$('#' + sliderID).removeAttr("disabled", "disabled");
}

function disableTilt(device) {
	let sliderID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_tilt_slider';
	$('#' + sliderID).attr("disabled", "disabled");
}

/* sets the Position slider to appropriate value based on the position slider */
function enablePosition(device) {
	let sliderID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_position_slider';
	$('#' + sliderID).removeAttr("disabled", "disabled");
}

function disablePosition(device) {
	let sliderID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_position_slider';
	$('#' + sliderID).attr("disabled", "disabled");
}

/* sets the Tilt slider to appropriate value based on the tilt value */
function setTiltSlider(device) {
	let sliderID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_tilt_slider';
	let slider = document.getElementById(sliderID);
	if (typeof(device.tilt) != 'undefined') {
		//sliderID.value = device.tilt;
		enableTilt(device);
		while (slider.value > device.tilt) {
			slider.stepDown();
			if (slider.value = device.tilt) break;
		} 
		while (slider.value < device.tilt) {
			slider.stepUp();
			if (slider.value = device.tilt) break;
		}
	}
}

function disableShadeDevice(device) {
	let FID = device.raspyID + '-' + device.devID + '-' + device.ardID;
	let button = $('#' + FID + '_direction');
	
	disablePosition(device);
	disableTilt(device);
	
	button.addClass('switch-button-error');
	button.attr("disabled", "disabled");
	button.html('<span class="fa fa-exclamation-circle" aria-hidden="true" id="' + FID + '_icon"></span> Unreachable');
}

function setPositionSlider(device) {
	let sliderID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_position_slider';
	let slider = document.getElementById(sliderID);
	if (typeof(device.position) != 'undefined') {
		enablePosition(device);
		console.log("setting position slider: enabled")
		while (slider.value > device.position) {
			slider.stepDown();
			if (slider.value = device.position) break;
		} 
		while (slider.value < device.position) {
			slider.stepUp();
			if (slider.value = device.position) break;
		}
	}
}

function onLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeAttr("disabled", "disabled");
	$('#' + buttonID).removeClass('switch-button-off');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).addClass('switch-button-on');
	$('#' + buttonID).addClass('text-white');
	$('#' + buttonID).html('<span class="fa fa-lightbulb-o" aria-hidden="true" id="' + iconID + '"></span> On');
}

function offLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeAttr("disabled", "disabled");
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).removeClass('text-white');
	$('#' + buttonID).addClass('switch-button-off');
	$('#' + buttonID).html('Off');
}

function errorLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).removeClass('switch-button-off');
	$('#' + buttonID).removeClass('text-white');
	$('#' + buttonID).addClass('switch-button-error');
	$('#' + buttonID).attr("disabled", "disabled");
	$('#' + buttonID).html('<span class="fa fa-exclamation-circle" aria-hidden="true" id="' + iconID + '"></span> Unreachable');
	
}

function disableLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	$('#' + buttonID).attr("disabled", "disabled");
	$('#' + buttonID).text('working...');
}

function enableLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	var value = devices[device.raspyID][device.ardID][device.devID].value;
	
	$('#' + buttonID).removeAttr("disabled");
	$('#' + buttonID).removeClass('switch-button-error');
	
	if (value == '0') {
		$('#' + buttonID).addClass('switch-button-off');
		$('#' + buttonID).text('Off');
	} else {
		$('#' + buttonID).addClass('switch-button-on');
		$('#' + buttonID).html('<span class="fa fa-lightbulb-o" aria-hidden="true" id="' + iconID + '"></span> On');
	}

}
