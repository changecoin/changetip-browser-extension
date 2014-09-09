/**
 * Define a simple addModule function. Each website that the changetip extension
 * supports will be a module - pass in a name and a function that returns a module
 * 
 * @type {Object}
 */
 var modules = {},
 Utils = {},
 ChangeTip = {};

 function addModule(moduleID, defineModule) {
	var base = {
		moduleID: moduleID,
		moduleName: moduleID,
		category: 'General',
		options: {},
		description: '',
		// the string used to mention changetip on this medium
		ctMentionString: null,
		// given a tipAmount, returns the message to be placed into a comment box, etc.
		getTipMessage: function(tipAmount) {
			throw "This module, " + moduleID + ", needs its getTipMessage function defined";
		},
		// handles the placement of the getTipMessage text
		submit: function(tipAmount) {
			throw "This module, " + moduleID + ", needs its submit function defined";
		},
		isEnabled: function() {
			// TODO: if we hypothetically allowed enable/disable of modules, we would
			// check a setting here and return false if the user has disabled.
			return true;
		},
		/**
		 * URLs this module should be run on
		 * 
		 * @type {Array}
		 */
		include: [
			'*'
		],
		/**
		 * URLs this module should not be run on
		 * 
		 * @type {Array}
		 */
		exclude: [],
		beforeLoad: function() { },
		init: function() { }
	};

	var module = defineModule.call(base, base, moduleID) || base;
	modules[moduleID] = module;
 }


/**
 * Iterate through an array in chunks, executing a callback on each element.
 * Each chunk is handled asynchronously from the others with a delay betwen each batch.
 * If the provided callback returns false iteration will be halted.
 */
 Utils.forEachChunked = function(array, chunkSize, delay, call) {
	if (typeof array === 'undefined' || array === null) {
		return;
	}
	if (typeof chunkSize === 'undefined' || chunkSize === null || chunkSize < 1) {
		return;
	}
	if (typeof delay === 'undefined' || delay === null || delay < 0) {
		return;
	}
	if (typeof call === 'undefined' || call === null) {
		return;
	}
	var counter = 0,
	length = array.length;

	function doChunk() {
		for (var end = Math.min(length, counter + chunkSize); counter < end; counter++) {
			var ret = call(array[counter], counter, array);
			if (ret === false) {
				return;
			}
		}
		if (counter < length) {
			window.setTimeout(doChunk, delay);
		}
	}
	window.setTimeout(doChunk, delay);
};

Utils.createElement = function(elementType, id, classname, textContent) {
	var obj = document.createElement(elementType);
	if (id) {
		obj.setAttribute('id', id);
	}
	if ((typeof classname !== 'undefined') && classname) {
		obj.setAttribute('class', classname);
	}
	if (textContent) {
		obj.textContent = textContent;
	}
	return obj;
};

ChangeTip = {
	init: function() {
		// figure out which module to run, and fire its init function
		var me = this,
			bgImgURL = chrome.extension.getURL('images/changetip_round_icon.png');

		me.activeModuleName = me.getModuleFromDomain();
		if (modules[me.activeModuleName] && typeof modules[me.activeModuleName].init === 'function') {
			me.activeModule = modules[me.activeModuleName];
			modules[me.activeModuleName].init();
		} else {
			// no module to run.
			return;
		}
		
		// create the dialog DIV and its children...
		me.dialog = Utils.createElement('div', 'changeTipDialog', null, null);

		// we can't focus the input until the css transition is complete, for
		// some reason it doesn't work if called during the transition.
		me.dialog.addEventListener('transitionend', function(e) {
			if ((e.propertyName === 'opacity') && (e.target.classList.contains('ct-visible'))) {
				me.dialogInput.focus();
			}
		}, false);


		me.dialogHeader = Utils.createElement('div', 'changeTipDialog-header', null, null);
		me.dialogHeader.textContent = 'ChangeTip';
		me.dialogHeader.style.backgroundImage = 'url('+bgImgURL+')';

		me.dialogCloseButton = Utils.createElement('div', 'changeTipDialog-closeButton', null, null);
		me.dialogCloseButton.innerHTML = '&#10005;';
		me.dialogCloseButton.addEventListener('click', me.closeDialog, false);
		me.dialogHeader.appendChild(me.dialogCloseButton);
		
		me.dialogBody = Utils.createElement('div', 'changeTipDialog-body', null, null);
		me.dialogForm = Utils.createElement('form');
		me.dialogForm.addEventListener('submit', me.submit, false);

		me.dialogInputLabel = Utils.createElement('label');
		me.dialogInputLabel.setAttribute('for','changeTip-amount');
		me.dialogInputLabel.textContent = 'Enter an amount:';

		me.dialogUsername = Utils.createElement('span', 'changeTipDialog-toUsername');

		me.tipAmountHelp = Utils.createElement('a','changeTipDialog-amount-help');
		me.tipAmountHelp.textContent = '?';
		me.tipAmountHelp.setAttribute('title','tip amounts reference');
		me.tipAmountHelp.setAttribute('target','_blank');
		me.tipAmountHelp.setAttribute('href','https://www.changetip.com/tip-amounts');

		me.dialogInput = Utils.createElement('input','changeTip-amount');
		me.dialogInput.setAttribute('type','text');
		me.dialogInput.setAttribute('placeholder', 'Enter your tip amount...');

		me.submitButton = Utils.createElement('input', 'changeTipDialog-submit');
		me.submitButton.setAttribute('type','submit');
		me.submitButton.value = 'Send Tip';

		me.clearDiv = Utils.createElement('div', null, 'changetip-clear');

		me.dialogForm.appendChild(me.dialogInputLabel);
		me.dialogForm.appendChild(me.tipAmountHelp);
		me.dialogForm.appendChild(me.dialogInput);
		me.dialogForm.appendChild(me.dialogUsername);
		me.dialogForm.appendChild(me.submitButton);

		me.dialogBody.appendChild(me.dialogForm);
		me.dialogBody.appendChild(me.clearDiv);

		me.dialog.appendChild(me.dialogHeader);
		me.dialog.appendChild(me.dialogBody);

		document.body.appendChild(me.dialog);
	},
	getModuleFromDomain: function() {
		var secondLevelDomain = window.location.hostname.split('.').slice(-2).join('.');
		return this.domainModules[secondLevelDomain];
	},
	domainModules: {
		'reddit.com': 'reddit'
	},
	// TODO: remember last tip amount, default to that on new tips
	getSetting: function(key) {
		// TODO: make actual getters/setters here.
		// use monikers - link to a reference?
		if (key === 'defaultAmount') {
			return '$10';
		}
	},
	openDialog: function(config) {
		config = config || {
			x: 200,
			y: 200,
			username: 'username'
		};
		ChangeTip.dialog.style.top = parseInt(config.y, 10) + 'px';
		ChangeTip.dialog.style.left = parseInt(config.x, 10) + 'px';
		ChangeTip.dialog.classList.add('ct-visible');
		ChangeTip.dialogUsername.textContent = 'sending to: ' + config.username;
		
		BabelExt.storage.get('lastAmount', ChangeTip.populateLastAmount);

		window.addEventListener('keyup', ChangeTip.listenForEscape, false);
	},
	submit: function(e) {
		e.preventDefault();

		ChangeTip.activeModule.submit(ChangeTip.dialogInput.value);
		BabelExt.storage.set('lastAmount', ChangeTip.dialogInput.value, ChangeTip.noop);
		ChangeTip.closeDialog();
	},
	populateLastAmount: function(returnData) {
		ChangeTip.dialogInput.value = returnData.value || '$5';
	},
	closeDialog: function() {
		ChangeTip.dialog.classList.remove('ct-visible');
		window.removeEventListener('keyup', ChangeTip.listenForEscape, false);
	},
	listenForEscape: function(e) {
		if (e.keyCode === 27) {
			ChangeTip.closeDialog();
		}
	},
	noop: function() {}
};