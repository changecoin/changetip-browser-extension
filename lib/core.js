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
		me.dialogCloseButton.addEventListener('click', me.cancelDialog, false);
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

		me.monikerQtyContainer = Utils.createElement('div', 'changeTipDialog-monikerQty-container');
		// me.monikerQtyLabel = Utils.createElement('label', null, null, "How many:");
		// me.monikerQtyLabel.setAttribute('for','changeTipDialog-monikerQty');
		me.monikerQty = Utils.createElement('input', 'changeTipDialog-monikerQty');
		me.monikerQty.setAttribute('type','text');
		me.monikerQty.setAttribute('placeholder','1');
		me.monikerQty.setAttribute('value','1'); // TODO: use last used value
		// me.monikerQtyContainer.appendChild(me.monikerQtyLabel);
		me.monikerQtyContainer.appendChild(me.monikerQty);

		me.monikerSelector = Utils.createElement('select', 'changeTipDialog-monikerSelect');
		// me.monikerSelectorButton = Utils.createElement('button', 'changeTipDialog-monikerSelect-button');
		// me.monikerSelectorButton.type = 'button';
		// me.monikerSelectorButton.textContent = 'ok';
		// me.monikerSelectorButton.addEventListener('click', me.addSelectedMoniker, false);
		me.monikerSelector.addEventListener('change', me.addSelectedMoniker);
		me.monikerQty.addEventListener('blur', me.addSelectedMoniker);

		me.monikerQtyContainer.appendChild(me.monikerSelector);
		// me.monikerQtyContainer.appendChild(me.monikerSelectorButton);

		me.dialogInput = Utils.createElement('input','changeTip-amount');
		me.dialogInput.setAttribute('type','text');
		me.dialogInput.setAttribute('placeholder', 'Enter your tip amount...');

		me.submitButton = Utils.createElement('input', 'changeTipDialog-submit');
		me.submitButton.setAttribute('type','submit');
		me.submitButton.value = 'Send Tip';

		me.clearDiv = Utils.createElement('div', null, 'changetip-clear');

		me.dialogForm.appendChild(me.dialogInputLabel);
		me.dialogForm.appendChild(me.tipAmountHelp);
		me.dialogForm.appendChild(me.monikerQtyContainer);
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
		ChangeTip.toUsername = config.username;
		ChangeTip.dialogUsername.textContent = 'sending to: ' + config.username;
		
		BabelExt.storage.get('lastQty', ChangeTip.populateLastQty);
		BabelExt.storage.get('lastMoniker', ChangeTip.populateLastMoniker);
		BabelExt.storage.get('lastAmountString', ChangeTip.populateLastAmountString);
		BabelExt.storage.get('tipTemplate', ChangeTip.setTipTemplate);

		this.getMonikers(this.populateMonikers);

		window.addEventListener('keyup', ChangeTip.listenForEscape, false);
	},
	submit: function(e) {
		var idx = ChangeTip.monikerSelector.selectedIndex,
			value = ChangeTip.monikerSelector.options[idx].value;

		e.preventDefault();

		ChangeTip.activeModule.submit(ChangeTip.dialogInput.value);
		BabelExt.storage.set('lastAmountString', ChangeTip.dialogInput.value, ChangeTip.noop);
		BabelExt.storage.set('lastQty', ChangeTip.monikerQty.value, ChangeTip.noop);
		BabelExt.storage.set('lastMoniker', value, ChangeTip.noop);
		ChangeTip.lastMoniker = value;
		ChangeTip.closeDialog();
	},
	populateLastQty: function(returnData) {
		ChangeTip.monikerQty.value = returnData.value || 'a';
	},
	populateLastMoniker: function(returnData) {
		// we won't have the options yet at this time, so we'll save it in memory
		// and then set it as 'selected' when encountered
		ChangeTip.lastMoniker = returnData.value;
	},
	populateLastAmountString: function(returnData) {
		ChangeTip.dialogInput.value = returnData.value || '$5';
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
	addSelectedMoniker: function() {
		var idx = ChangeTip.monikerSelector.selectedIndex,
			value = ChangeTip.monikerSelector.options[idx].value,
			qty = (ChangeTip.monikerQty.value > 1) ? ChangeTip.monikerQty.value : 'a',
			plural = (qty > 1) ? 's' : '';

		ChangeTip.dialogInput.value = qty + ' ' + value + plural;
	},
	getMonikers: function(callback) {
		if (typeof callback !== 'function') {
			throw "getMonikers called without a callback"; 
		}
		if (!this.monikerCache) {
			BabelExt.xhr({
				url: 'https://www.changetip.com/v1/monikers?limit=50',
				onload: function(response) {
					var data;

					try {
						data = JSON.parse(response.responseText);
						ChangeTip.monikerCache = data;
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
			callback(this.monikerCache);
		}
	},
	populateMonikers: function(data) {
		// clear out the select box for repopulation
		ChangeTip.monikerSelector.innerHTML = '';
		var i = 0,
			len = (data.objects) ? data.objects.length : 0,
			option;

		for (; i < len; i++) {
			option = Utils.createElement('option');
			option.value = data.objects[i].name;
			if (option.value === ChangeTip.lastMoniker) {
				option.selected = 'true';
			} else {
				option.removeAttribute('selected');
			}
			option.textContent = data.objects[i].name;
			ChangeTip.monikerSelector.appendChild(option);
		}
		$(ChangeTip.monikerSelector).show();
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
// shim since we don't need all of BrowserDetect from RES
var BrowserDetect = {
	MutationObserver: window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver || null
};

RESUtils.initObservers = function() {
	var siteTable, observer;

	if (document.body.classList.contains('res')) {
		window.addEventListener('RES-mutation-newComments', function(e) {
			debugger;
		});
		return;
	}
	if (RESUtils.pageType() !== 'comments') {
		// initialize sitetable observer...
		siteTable = document.getElementById('siteTable');
		var stMultiCheck = document.querySelectorAll('#siteTable');
		if (stMultiCheck.length === 2) {
			siteTable = stMultiCheck[1];
		}

		if (BrowserDetect.MutationObserver && siteTable) {
			observer = new BrowserDetect.MutationObserver(function(mutations) {
				mutations.forEach(function(mutation) {
					if (mutation.addedNodes[0].id.indexOf('siteTable') !== -1) {
						// when a new sitetable is loaded, we need to add new observers for selftexts within that sitetable...
						$(mutation.addedNodes[0]).find('.entry div.expando').each(function() {
							RESUtils.addSelfTextObserver(this);
						});
						RESUtils.watchers.siteTable.forEach(function(callback) {
							if (callback) callback(mutation.addedNodes[0]);
						});
					}
				});
			});

			observer.observe(siteTable, {
				attributes: false,
				childList: true,
				characterData: false
			});
		} else {
			// Opera doesn't support MutationObserver - so we need this for Opera support.
			if (siteTable) {
				siteTable.addEventListener('DOMNodeInserted', function(event) {
					if ((event.target.tagName === 'DIV') && (event.target.getAttribute('id') && event.target.getAttribute('id').indexOf('siteTable') !== -1)) {
						RESUtils.watchers.siteTable.forEach(function(callback) {
							if (callback) callback(event.target);
						});
					}
				}, true);
			}
		}
	} else {
		// initialize sitetable observer...
		siteTable = document.querySelector('.commentarea > .sitetable');

		if (BrowserDetect.MutationObserver && siteTable) {
			observer = new BrowserDetect.MutationObserver(function(mutations) {
				mutations.forEach(function(mutation) {
					if (mutation.addedNodes.length > 0 && mutation.addedNodes[0].classList.contains('thing')) {
						var thing = mutation.addedNodes[0];
						var newCommentEntry = thing.querySelector('.entry');
						if (!$(newCommentEntry).data('alreadyDetected')) {
							$(newCommentEntry).data('alreadyDetected', true);
							$(thing).find('.child').each(function() {
								RESUtils.addNewCommentFormObserver(this);
							});
							RESUtils.watchers.newComments.forEach(function(callback) {
								if (callback) callback(newCommentEntry);
							});
						}
					}
				});
			});

			observer.observe(siteTable, {
				attributes: false,
				childList: true,
				characterData: false
			});
		} else {
			// Opera doesn't support MutationObserver - so we need this for Opera support.
			if (siteTable) {
				siteTable.addEventListener('DOMNodeInserted', RESUtils.mutationEventCommentHandler, false);
			}
		}
	}

	$('.entry div.expando').each(function() {
		RESUtils.addSelfTextObserver(this);
	});

	// initialize new comments observers on demand, by first wiring up click listeners to "load more comments" buttons.
	// on click, we'll add a mutation observer...
	$('.morecomments a').on('click', RESUtils.addNewCommentObserverToTarget);

	// initialize new comments forms observers on demand, by first wiring up click listeners to reply buttons.
	// on click, we'll add a mutation observer...
	// $('body').on('click', 'ul.flat-list li a[onclick*=reply]', RESUtils.addNewCommentFormObserver);
	$('.thing .child').each(function() {
		RESUtils.addNewCommentFormObserver(this);
	});
};
RESUtils.addNewCommentObserverToTarget = function(e) {
	var ele = $(e.currentTarget).closest('.sitetable')[0];
	// mark this as having an observer so we don't add multiples...
	if (!$(ele).hasClass('hasObserver')) {
		$(ele).addClass('hasObserver');
		RESUtils.addNewCommentObserver(ele);
	}
};
RESUtils.addNewCommentObserver = function(ele) {
	var mutationNodeToObserve = ele;
	if (BrowserDetect.MutationObserver) {
		var observer = new BrowserDetect.MutationObserver(function(mutations) {
			// we need to get ONLY the nodes that are new...
			// get the nodeList from each mutation, find comments within it,
			// then call our callback on it.
			for (var i = 0, len = mutations.length; i < len; i++) {
				var thisMutation = mutations[i];
				var nodeList = thisMutation.addedNodes;
				// look at the added nodes, and find comment containers.
				for (var j = 0, jLen = nodeList.length; j < jLen; j++) {
					if (nodeList[j].classList.contains('thing')) {
						$(nodeList[j]).find('.child').each(function() {
							RESUtils.addNewCommentFormObserver(this);
						});

						// check for "load new comments" links within this group as well...
						$(nodeList[j]).find('.morecomments a').click(RESUtils.addNewCommentObserverToTarget);

						var subComments = nodeList[j].querySelectorAll('.entry');
						// look at the comment containers and find actual comments...
						for (var k = 0, kLen = subComments.length; k < kLen; k++) {
							var thisComment = subComments[k];
							if (!$(thisComment).data('alreadyDetected')) {
								$(thisComment).data('alreadyDetected', true);
								RESUtils.watchers.newComments.forEach(function(callback) {
									if (callback) callback(thisComment);
								});
							}
						}
					}
				}
			}

			// RESUtils.watchers.newComments.forEach(function(callback) {
			// // add form observers to these new comments we've found...
			//	$(mutations[0].target).find('.thing .child').each(function() {
			//		RESUtils.addNewCommentFormObserver(this);
			//	});
			//	// check for "load new comments" links within this group as well...
			//	$(mutations[0].target).find('.morecomments a').click(RESUtils.addNewCommentObserverToTarget);
			//	callback(mutations[0].target);
			// });

			// disconnect this observer once all callbacks have been run.
			// unless we have the nestedlisting class, in which case don't disconnect because that's a
			// bottom level load more comments where even more can be loaded after, so they all drop into this
			// same .sitetable div.
			if (!$(ele).hasClass('nestedlisting')) {
				observer.disconnect();
			}
		});

		observer.observe(mutationNodeToObserve, {
			attributes: false,
			childList: true,
			characterData: false
		});
	} else {
		mutationNodeToObserve.addEventListener('DOMNodeInserted', RESUtils.mutationEventCommentHandler, false);
	}
};
RESUtils.addNewCommentFormObserver = function(ele) {
	var commentsFormParent = ele;
	if (BrowserDetect.MutationObserver) {
		// var mutationNodeToObserve = moreCommentsParent.parentNode.parentNode.parentNode.parentNode;
		var observer = new BrowserDetect.MutationObserver(function(mutations) {
			var form = $(mutations[0].target).children('form');
			if ((form) && (form.length === 1)) {
				RESUtils.watchers.newCommentsForms.forEach(function(callback) {
					callback(form[0]);
				});
			} else {
				var newOwnComment = $(mutations[0].target).find(' > div.sitetable > .thing:first-child'); // assumes new comment will be prepended to sitetable's children
				if ((newOwnComment) && (newOwnComment.length === 1)) {
					// new comment detected from the current user...
					RESUtils.watchers.newComments.forEach(function(callback) {
						callback(newOwnComment[0]);
					});
				}
			}
		});

		observer.observe(commentsFormParent, {
			attributes: false,
			childList: true,
			characterData: false
		});
	} else {
		// Opera doesn't support MutationObserver - so we need this for Opera support.
		commentsFormParent.addEventListener('DOMNodeInserted', function(event) {
			// TODO: proper tag filtering here, it's currently all wrong.
			if (event.target.tagName === 'FORM') {
				RESUtils.watchers.newCommentsForms.forEach(function(callback) {
					if (callback) callback(event.target);
				});
			} else {
				var newOwnComment = $(event.target).find(' > div.sitetable > .thing:first-child'); // assumes new comment will be prepended to sitetable's children
				if ((newOwnComment) && (newOwnComment.length === 1)) {
					// new comment detected from the current user...
					RESUtils.watchers.newComments.forEach(function(callback) {
						callback(newOwnComment[0]);
					});
				}
			}
		}, true);
	}
};
RESUtils.addSelfTextObserver = function(ele) {
	var selfTextParent = ele;
	if (BrowserDetect.MutationObserver) {
		// var mutationNodeToObserve = moreCommentsParent.parentNode.parentNode.parentNode.parentNode;
		var observer = new BrowserDetect.MutationObserver(function(mutations) {
			var form = $(mutations[0].target).find('form');
			if ((form) && (form.length > 0)) {
				RESUtils.watchers.selfText.forEach(function(callback) {
					callback(form[0]);
				});
			}
		});

		observer.observe(selfTextParent, {
			attributes: false,
			childList: true,
			characterData: false
		});
	} else {
		// Opera doesn't support MutationObserver - so we need this for Opera support.
		selfTextParent.addEventListener('DOMNodeInserted', function(event) {
			// TODO: proper tag filtering here, it's currently all wrong.
			if (event.target.tagName === 'FORM') {
				RESUtils.watchers.selfText.forEach(function(callback) {
					if (callback) callback(event.target);
				});
			}
		}, true);
	}
};
RESUtils.watchForElement = function(type, callback) {
	switch (type) {
		case 'siteTable':
			RESUtils.watchers.siteTable.push(callback);
			break;
		case 'newComments':
			RESUtils.watchers.newComments.push(callback);
			break;
		case 'selfText':
			RESUtils.watchers.selfText.push(callback);
			break;
		case 'newCommentsForms':
			RESUtils.watchers.newCommentsForms.push(callback);
			break;
	}
};
RESUtils.watchers = {
	siteTable: [],
	newComments: [],
	selfText: [],
	newCommentsForms: []
};