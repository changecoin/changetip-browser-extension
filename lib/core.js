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

Utils.debounce = function(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) {
				func.apply(context, args);
			}
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) {
			func.apply(context, args);
		}
	};
};

ChangeTip = {
	init: function() {
		// figure out which module to run, and fire its init function
		var me = this;

		this.headerImgURL = chrome.extension.getURL('images/header_logo.svg');
		this.sendImgURL = chrome.extension.getURL('images/Icon-Hat-Tilted.png');
		this.helpImgURL = chrome.extension.getURL('images/help_icon.svg');
		// this.bgImgURL = chrome.extension.getURL('images/changetip_round_icon.png');

		me.activeModuleName = me.getModuleFromDomain();
		if (modules[me.activeModuleName] && typeof modules[me.activeModuleName].init === 'function') {
			// since there's a module to run, add CSS rules via javascript for classes where we need to
			// dynamically generate image URLs.
			me.addCSSRules();

			me.activeModule = modules[me.activeModuleName];

			// based on the dialog type, our setters and getters will behave differently.
			me.dialogType = me.activeModule.usesIframe ? 'iframe' : 'div';

			me.createDialog(me.dialogType === 'iframe');

			modules[me.activeModuleName].init();
		} else {
			// no module to run.
			return;
		}
	},
	iframeUrl: 'https://www.changetip.com/browser_extension/widget.html',
	addCSSRules: function() {
		var styleNode = document.createElement("style");
		styleNode.type = "text/css";
		styleNode.textContent = "@font-face { font-family: 'Harabara'; src: url('" +
									chrome.extension.getURL("fonts/Harabara.otf") +
								"'); }\n" +
								"@font-face { font-family: 'Lato'; src: url('" +
									chrome.extension.getURL("fonts/Lato-Regular.ttf") +
								"'); }\n";
		// regular first
		styleNode.textContent += ".changetip-textarea-button, .changetip-inline-button { " +
									"background-size: 12px 12px;" +
									"background-image: url(" + chrome.extension.getURL("images/field_1x.png") + "); " +
								"}\n" +
								".changetip-textarea-button:hover, .changetip-inline-button:hover { " +
									"background-image: url(" + chrome.extension.getURL("images/field-hover_1x.png") + ")" +
								"}\n";
		// and retina
		styleNode.textContent += "@media only screen and (-Webkit-min-device-pixel-ratio: 1.5), " +
								"only screen and (-moz-min-device-pixel-ratio: 1.5), " +
								"only screen and (-o-min-device-pixel-ratio: 3/2), " +
								"only screen and (min-device-pixel-ratio: 1.5) { \n" +
									".changetip-textarea-button, .changetip-inline-button { " +
									"background-image: url(" + chrome.extension.getURL("images/field_2x.png") + "); " +
									"} \n" +
									".changetip-textarea-button:hover, .changetip-inline-button:hover { " +
									"background-image: url(" + chrome.extension.getURL("images/field-hover_2x.png") + ")" +
									"} \n" +
								"}\n";
		document.head.appendChild(styleNode);
	},
	updateFiatPreview: function(wordData) {
		var me = this;
		// TODO: fix this on API side, symbol is coming through empty
		if (wordData.currency.abbreviation === "USD") {
			wordData.currency.symbol = "$";
		}
		me.fiatPreview.textContent = '~' + me.tipQty + 'x' + wordData.currency.symbol + (Math.round(wordData.value * 100) / 100);
	},
	getModuleFromDomain: function() {
		var secondLevelDomain = window.location.hostname.split('.').slice(-2).join('.');
		return this.domainModules[secondLevelDomain];
	},
	domainModules: {
		'reddit.com': 'reddit',
		'twitter.com': 'twitter',
		'head-fi.org': 'huddler', // for now we're using a specific domain, we'll probably do some magic in the future.
		'google.com': 'youtube', // comments are loaded in a widget from apis.google.com
		'youtube.com': 'youtube'
	},
	// TODO: remember last tip amount, default to that on new tips
	getSetting: function(key) {
		// TODO: make actual getters/setters here.
		// use monikers - link to a reference?
		if (key === 'defaultAmount') {
			return 'a cookie';
		}
	},
	/**
	 * The dialog may be all self-assembled HTML, or may be an iframe.
	 *
	 * @param  {boolean} iframe if true, use an iframe rather than self-assembled HTML
	 */
	createDialog: function(iframe) {
		var me = this;

		// create the dialog DIV (or iFrame) and its children...
		if (iframe) {
			me.dialog = Utils.createElement('IFRAME', 'changeTipDialog', 'changetip-iframe changetip-font-body', null);
			window.addEventListener("message", ChangeTip.handlePostMessage, false);
		} else {
			me.dialog = Utils.createElement('DIV', 'changeTipDialog', 'changetip-font-body', null);

			// we can't focus the input until the css transition is complete, for
			// some reason it doesn't work if called during the transition.
			me.dialog.addEventListener('transitionend', function(e) {
				if ((e.propertyName === 'opacity') && (e.target.classList.contains('ct-visible'))) {
					me.dialogInput.focus();
				}
			}, false);


			me.dialogHeader = Utils.createElement('div', 'changeTipDialog-header', null, null);
			// this is done programmatically instead of in CSS because browser extension architecture
			// requires a path that is unique to each browser.
			me.dialogHeader.style.backgroundImage = 'url('+this.headerImgURL+')';

			me.dialogCloseButton = Utils.createElement('div', 'changeTipDialog-closeButton', null, null);
			me.dialogCloseButton.innerHTML = '&#10005;';
			me.dialogCloseButton.addEventListener('click', me.cancelDialog, false);
			me.dialogHeader.appendChild(me.dialogCloseButton);

			me.dialogBody = Utils.createElement('div', 'changeTipDialog-body', null, null);
			me.dialogAvatar = Utils.createElement('img', 'changeTipDialog-avatar');
			me.dialogAvatarBreak = Utils.createElement('br');

			me.dialogToUserContainer = Utils.createElement('div', 'changeTipDialog-toUserContainer');
			me.dialogToUserContainer.textContent = 'Send a tip to: ';
			me.dialogToUserContainer.appendChild(me.dialogAvatarBreak);

			me.dialogUsername = Utils.createElement('span', 'changeTipDialog-toUsername');
			me.dialogToUserContainer.appendChild(me.dialogUsername);

			me.dialogForm = Utils.createElement('form');
			me.dialogForm.addEventListener('submit', me.submit, false);

			me.dialogInputLabel = Utils.createElement('label');
			me.dialogInputLabel.setAttribute('for','changeTip-amount');
			me.dialogInputLabel.textContent = 'Enter an amount:';

			me.fiatPreview = Utils.createElement('span', 'changeTip-fiatPreview');


			me.tipAmountHelp = Utils.createElement('a','changeTipDialog-amount-help');
			me.tipAmountHelp.style.backgroundImage = 'url('+this.helpImgURL+')';
			me.tipAmountHelp.setAttribute('title','tip amounts reference');
			me.tipAmountHelp.setAttribute('target','_blank');
			me.tipAmountHelp.setAttribute('href','https://www.changetip.com/tip-amounts');

			me.submitButton = Utils.createElement('input', 'changeTipDialog-submit');
			me.submitButton.className = 'changetip-submit';
			me.submitButton.setAttribute('type','submit');
			// HTML form submit buttons have to be styled using "background", not "background-image"
			// due to some oddity in the w3c spec. It's unfortunate we can't decouple style from
			// the code here, but because we need to programatically set up the img URL, we have
			// to have the style parameters here too.
			me.submitButton.style.background = '#005197 url('+this.sendImgURL+') no-repeat 5px 4px / 23px 23px';
			me.submitButton.value = 'Tip';

			me.bodyClearDiv = Utils.createElement('div', null, 'changetip-clear');
			me.formClearDiv = Utils.createElement('div', null, 'changetip-clear');

			me.dialogForm.appendChild(me.dialogInputLabel);
			me.dialogForm.appendChild(me.tipAmountHelp);
			me.dialogForm.appendChild(me.fiatPreview);
			// me.dialogForm.appendChild(me.monikerQtyContainer);

			// me.dialogForm.appendChild(me.dialogInput);
			me.dialogInputContainer = completely(me.dialogForm, {
				dropDownBorderColor: '#ddd',
				fontSize: '24px',
				fontFamily: 'sans-serif'
			});

			me.dialogInputContainer.wrapper.classList.add('changeTip-amount');
			me.dialogInputContainer.hint.classList.add('changeTip-amount-hint');
			me.dialogInputContainer.dropDown.classList.add('changeTip-amount-dropdown');
			me.dialogInputContainer.onChange = function(text) {
				var words = text.split(' '),
					lastWord = words[words.length-1],
					prevWord = (words.length > 1) ? words[words.length-2] : null,
					digits = /[0-9]+/,
					prevWordIsQty = (prevWord === 'a') || (prevWord === 'an') || (digits.test(prevWord)),
					wordData;

				// if the first word is "a", "an", or all digits,
				// then start listening for autocomplete
				if (prevWordIsQty && text.length > prevWord.length) {
					ChangeTip.tipQty = parseInt(prevWord, 10) || 1;
					if (ChangeTip.tipQty > 1) {
						ChangeTip.dialogInputContainer.options = ChangeTip.monikerCachePlural;
					} else {
						ChangeTip.dialogInputContainer.options = ChangeTip.monikerCacheSingular;
					}
					ChangeTip.dialogInputContainer.startFrom = text.length - lastWord.length;
					ChangeTip.dialogInputContainer.repaint();
				} else {
					ChangeTip.dialogInputContainer.startFrom = 0;
					ChangeTip.dialogInputContainer.options = [];
					ChangeTip.dialogInputContainer.repaint();
				}
				wordData = ChangeTip.getMonikerDataByName(lastWord);
				if (wordData) {
					// do stuff with wordData...
					ChangeTip.updateFiatPreview(wordData);
				}
				return;
			};
			me.dialogInput = me.dialogInputContainer.input;
			// TODO: add enter key = submit support but not on autocomplete.
			me.dialogInput.setAttribute('type','text');
			me.dialogInput.setAttribute('placeholder', 'Enter your tip amount...');

			me.dialogForm.appendChild(me.submitButton);
			me.dialogForm.appendChild(me.formClearDiv);

			me.dialogBody.appendChild(me.dialogAvatar);
			me.dialogBody.appendChild(me.dialogToUserContainer);
			me.dialogBody.appendChild(me.bodyClearDiv);
			me.dialogBody.appendChild(me.dialogForm);

			me.dialog.appendChild(me.dialogHeader);
			me.dialog.appendChild(me.dialogBody);
		}
	},
	handlePostMessage: function(e) {
		var message = e.data;
		switch (message.type) {
			case 'size':
				ChangeTip.dialog.isLoaded = true;
				ChangeTip.dialog.style.height = message.data.h + 'px';
				ChangeTip.dialog.style.width = message.data.w + 'px';
				break;
			case 'close':
				ChangeTip.closeDialog();
				break;
			case 'oneTimeTip':
				ChangeTip.activeModule.handleOneTimeTipLink(message);
				break;
			default:
				console.log('Unrecognized message type in postMessage: ', message);
				break;
		}
	},
	openDialog: function(config) {
		ChangeTip.dialogIsOpen = true;
		config = config || {
			x: 200,
			y: 200,
			fixed: false,
			username: 'username',
			avatar: null,
			metadata: {}
		};
		// if not yet appended, append dialog or iframe
		if (!ChangeTip.dialogIsAppended) {
			document.body.appendChild(ChangeTip.dialog);
			ChangeTip.dialogIsAppended = true;
		}
		$(ChangeTip.dialog).removeClass('has-avatar');
		if (config.avatar) {
			$(ChangeTip.dialog).addClass('has-avatar');
		}
		ChangeTip.dialog.style.top = parseInt(config.y, 10) + 'px';
		ChangeTip.dialog.style.left = parseInt(config.x, 10) + 'px';
		if (config.fixed) {
			ChangeTip.dialog.style.position = 'fixed';
		} else {
			ChangeTip.dialog.style.position = 'absolute';
		}
		ChangeTip.dialog.classList.add('ct-visible');

		if (ChangeTip.dialogType === 'iframe') {
			var params = '?username='+config.username;
			if (config.avatar) {
				params += '&avatar='+config.avatar;
			}
			if (config.amount) {
				params += '&amount='+config.amount;
			}
			ChangeTip.dialog.src = ChangeTip.iframeUrl + params;
		} else {
			this.setAvatar(config.avatar);
			this.setMetadata(config.metadata);
		}
		// we need to set the username whether iframe or not so it's stored locally.
		this.setUsername(config.username);

		// BabelExt.storage.get('lastQty', ChangeTip.populateLastQty);
		// BabelExt.storage.get('lastMoniker', ChangeTip.populateLastMoniker);
		BabelExt.storage.get('lastAmountString', ChangeTip.populateLastAmountString);
		BabelExt.storage.get('tipTemplate', ChangeTip.setTipTemplate);

		// only do this for non-iframe. In the iframe, this will be handled locally.
		if (ChangeTip.dialogType !== 'iframe') {
			ChangeTip.getMonikers(this.populateMonikers);
		}

		window.addEventListener('keyup', ChangeTip.listenForEscape, false);
	},
	setAvatar: function(avatar) {
		if (ChangeTip.dialogType !== 'iframe') {
			ChangeTip.dialogAvatar.src = avatar;
			ChangeTip.avatar = avatar;
		} else {
			ChangeTip.sendIframePostMessage({
				type: 'avatar',
				data: {
					avatar: avatar
				}
			});
		}
	},
	setMetadata: function(metadata) {
		// we don't currently need to set any metadata for iframe versions.
		if (ChangeTip.dialogType !== 'iframe') {
			ChangeTip.metadata = metadata;
		}
	},
	setUsername: function(username) {
		ChangeTip.toUsername = username;
		if (ChangeTip.dialogType !== 'iframe') {
			ChangeTip.dialogUsername.textContent = username;
		} else {
			ChangeTip.sendIframePostMessage({
				type: 'username',
				data: {
					username: username
				}
			});
		}
	},
	/**
	 * We can't send a message unless the iframe is completely loaded, so if it's not yet, delay the message.
	 * @param  {Object} message the message to be sent
	 */
	sendIframePostMessage: function(message) {
		if (ChangeTip.dialog.isLoaded === true) {
			ChangeTip.dialog.contentWindow.postMessage(message, '*');
		} else {
			setTimeout(function() {
				ChangeTip.sendIframePostMessage(message);
			}, 50);
		}
	},
	submit: function(e) {
		e.preventDefault();

		ChangeTip.activeModule.submit(ChangeTip.dialogInput.value);
		BabelExt.storage.set('lastAmountString', ChangeTip.dialogInput.value, ChangeTip.noop);
		ChangeTip.closeDialog();
	},
	populateLastAmountString: function(returnData) {
		if (ChangeTip.dialogType !== 'iframe') {
			ChangeTip.dialogInput.value = returnData.value || '$5';
		} else {
			ChangeTip.sendIframePostMessage({
				type: 'amount',
				data: {
					amount: returnData.value || '$5'
				}
			});
		}
	},
	setTipTemplate: function(returnData) {
		ChangeTip.template = returnData.value || 'have {tipAmount} on me, {username}!';
	},
	applyTipTemplate: function(tipAmount) {
		return ChangeTip.template.replace('{tipAmount}', tipAmount).replace('{username}', ChangeTip.toUsername);
	},
	cancelDialog: function() {
		ChangeTip.closeDialog(true);
	},
	closeDialog: function(cancel) {
		ChangeTip.dialogIsOpen = false;
		ChangeTip.dialog.classList.remove('ct-visible');
		if (cancel && typeof ChangeTip.activeModule.onCancel === 'function') {
			ChangeTip.activeModule.onCancel();
		}
		window.removeEventListener('keyup', ChangeTip.listenForEscape, false);
	},
	listenForEscape: function(e) {
		if (e.keyCode === 27) {
			ChangeTip.closeDialog(true);
		}
	},
	getMonikers: function(callback) {
		if (typeof callback !== 'function') {
			throw "getMonikers called without a callback";
		}
		if (!this.monikerDataCache) {
			BabelExt.xhr({
				url: 'https://api.changetip.com/v1/monikers?limit=50',
				onload: function(response) {
					var data;

					try {
						data = JSON.parse(response.responseText);
						ChangeTip.monikerDataCache = data;
						callback(data);
					} catch (e) {
						console.error('moniker data was not valid json:', e.message, data);
					}
				},
				onerror: function() {
					$(ChangeTip.monikerSelector).hide();
				}
			});
		} else {
			callback(this.monikerDataCache);
		}
	},
	populateMonikers: function(data) {
		var i = 0,
			len = (data.objects) ? data.objects.length : 0;

		// clear out the select box for repopulation
		ChangeTip.monikerCacheSingular = [];
		ChangeTip.monikerCachePlural = [];

		for (; i < len; i++) {
			ChangeTip.monikerCacheSingular.push(data.objects[i].name);
			ChangeTip.monikerCachePlural.push(data.objects[i].plural);
		}

		ChangeTip.monikerCacheSingular.sort();
		ChangeTip.monikerCachePlural.sort();

		// force a parse of the initial value prior to typing/input.
		ChangeTip.dialogInputContainer.onChange(ChangeTip.dialogInput.value);
	},
	getMonikerDataByName: function(name) {
		if (!this.monikerDataCache) {
			throw "No moniker data cache is present. Cannot look up " + name;
		}
		var i = 0,
			len = this.monikerDataCache.objects.length,
			obj;

		// lop off the trailing s for plural requests
		if (ChangeTip.tipQty > 1) {
			if (name.substr(-1) === 's') {
				name = name.substr(0,name.length-1);
			}
		}
		for (; i < len; i++) {
			obj = this.monikerDataCache.objects[i];
			if (obj.name === name) {
				return obj;
			}
		}
	},
	noop: function() {}
};


// the following code is borrowed from RESUtils.js in Reddit Enhancement
// Suite -- mutationObserver handler functions for detecting new content
RESUtils = {};
RESUtils.allRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\//i;
RESUtils.commentsRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/[-\w\.\/]*\/comments/i;
RESUtils.friendsCommentsRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/r\/friends\/*comments/i;
RESUtils.inboxRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:r\/[-\w\.\/]+?\/)?message\//i;
RESUtils.profileRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/user\/([-\w\.#=]*)\/?(?:comments)?\/?(?:\?(?:[a-z]+=[a-zA-Z0-9_%]*&?)*)?$/i;
RESUtils.submitRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:[-\w\.\/]*\/)?submit\/?(?:\?.*)?$/i;
RESUtils.prefsRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/prefs/i;
RESUtils.wikiRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:r\/[-\w\.]+\/)?wiki/i;
RESUtils.styleSheetRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:r\/[-\w\.]+\/)?about\/stylesheet/i;
RESUtils.searchRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:[-\w\.\/]*\/)?search/i;
RESUtils.pageType = function() {
	if (typeof this.pageTypeSaved === 'undefined') {
		var pageType = '';
		var currURL = location.href.split('#')[0];
		if (RESUtils.profileRegex.test(currURL)) {
			pageType = 'profile';
		} else if ((RESUtils.commentsRegex.test(currURL)) || (RESUtils.friendsCommentsRegex.test(currURL))) {
			pageType = 'comments';
		} else if (RESUtils.inboxRegex.test(currURL)) {
			pageType = 'inbox';
		} else if (RESUtils.submitRegex.test(currURL)) {
			pageType = 'submit';
		} else if (RESUtils.prefsRegex.test(currURL)) {
			pageType = 'prefs';
		} else if (RESUtils.wikiRegex.test(currURL)) {
			pageType = 'wiki';
		} else if (RESUtils.styleSheetRegex.test(currURL)) {
			pageType = 'stylesheet';
		} else {
			pageType = 'linklist';
		}
		this.pageTypeSaved = pageType;
	}
	return this.pageTypeSaved;
};
RESUtils.getXYpos = function(obj) {
	var topValue = 0,
		leftValue = 0;
	while (obj) {
		leftValue += obj.offsetLeft;
		topValue += obj.offsetTop;
		obj = obj.offsetParent;
	}
	return {
		'x': leftValue,
		'y': topValue
	};
};

// shim since we don't need all of BrowserDetect from RES
// but we're going to lie and say we don't support it, or we'll conflict with RES.
// we can't have two mutationobservers on the same node - it just doesn't work.
var BrowserDetect = {
	// MutationObserver: window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver || null
};
