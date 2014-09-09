addModule('reddit', function(module, moduleID) {
	module.moduleName = 'Reddit';
	module.category = 'Site Modules';

	module.init = function() {
		module.pageType = module.getPageType();
		switch(module.pageType) {
			case 'comments':
				module.handleComments();
				break;
			case 'linklist':
				break;
		}
	};

	// the string used to mention changetip on this medium
	module.ctMentionString = '/u/changetip';

	/**
	 * given a username and amount, return a message string to be appended
	 * to the comment reply box
	 * 
	 * @return {string} message to be placed into comment box
	 */
	module.getTipMessage = function(tipAmount) {
		return 'Have ' + tipAmount + ' on me! ' + module.ctMentionString;
	};

	/**
	 * handle form submission from the ChangTip dialog - this function
	 * should call module.getTipMessage, and place that message in to
	 * the appropriate place
	 */
	module.submit = function(tipAmount) {
		var tipString = module.getTipMessage(tipAmount);

		// add newlines if there's already text in the box...
		if (module.textarea.value) {
			module.textarea.value += "\n\n";
		}
		module.textarea.value += tipString;
		module.textarea.focus();
	};

	/**
	 * Attach a tip button to comments
	 * 
	 * @return {[type]} [description]
	 */
	module.handleComments = function() {
		var postUsername = document.querySelector('#siteTable a.author').textContent,
			postList,
			buttonLists,
			postTipButton;

		postList = document.querySelector('#siteTable .flat-list.buttons');

		if (postList) {
			postTipButton = module.createTipButton(postUsername);
			postList.appendChild(postTipButton);
		}

		// attach a button to each list of buttons
		buttonLists = document.querySelectorAll('.comment .flat-list.buttons');

		// we use "chunking" because making hundreds of DOM manipulations synchronously
		// would lock the UI, so we'll do 15 every second, then release the UI, then do
		// 15 more, etc...
		Utils.forEachChunked(buttonLists, 15, 1000, module.attachButtonToCommentList);
	};

	module.attachButtonToCommentList = function(list) {
		// "load more comments" links show up as empty lists, abort mission.
		if (!list || !list.lastChild) {
			return;
		}

		var username = $(list).closest('.entry').find('a.author').text(),
			replyButton = module.getReplyButtonFromList(list),
			// get the username of who this button will tip
			replyButtonContainer = replyButton.parentNode,
			tipButtonContainer = module.createTipButton(username, replyButton);

		// add our newly created button to the DOM
		if (tipButtonContainer) {
			list.insertBefore(tipButtonContainer, replyButtonContainer);
		}
	};

	module.createTipButton = function(username, replyButton) {
		var tipButtonContainer = Utils.createElement('li', null, 'changetip-button-container', null),
			tipButton = Utils.createElement('a', null, 'changetip-button', 'changetip'),
			username;

		// don't bother adding the button for the changetip user
		if (username === 'changetip') {
			return;
		}
		tipButton.setAttribute('href','javascript:void(0)');
		tipButton.setAttribute('data-username', username);
		tipButton.setAttribute('title', 'send a changetip to ' + username);
		if (replyButton) {
			tipButton.replyButton = replyButton;
		}
		tipButton.addEventListener('click', module.tipViaComment, false);
		tipButtonContainer.appendChild(tipButton);

		return tipButtonContainer;
	};

	module.tipViaComment = function(e) {
		var tipButton = e.target,
			username = tipButton.getAttribute('data-username'),
			textarea;

		if (tipButton.replyButton) {
			$(tipButton.replyButton).click();
			textarea = $(tipButton.replyButton).closest('.comment').find('.usertext-edit textarea')[0];
		} else {
			textarea = $('.commentarea .usertext-edit textarea')[0];
		}
		if (!textarea) {
			throw "ChangeTip Exception: comment textarea not found";
		}
		module.textarea = textarea;
		ChangeTip.openDialog({
			x: tipButton.offsetLeft,
			y: tipButton.offsetTop + 20,
			textarea: textarea,
			amount: ChangeTip.getSetting('defaultAmount'),
			username: username
		});
	};

	module.getReplyButtonFromList = function(list) {
		// "load more comments" links show up as empty lists, abort mission.
		if (!list || !list.lastChild) {
			return;
		}
		// Usually, this should be the next sibling, but this is a brittle structure based
		// on DOM order, so we want to be safe and make sure.
		var replyButton = list.lastChild.querySelector('a');

		if (replyButton && replyButton.getAttribute('onclick') && replyButton.getAttribute('onclick').indexOf('reply') !== -1) {
			return replyButton;
		}

		var allButtons = list.querySelectorAll('a'),
			i = 0,
			len = allButtons.length;

		while (i < len) {
			if (allButtons[i].getAttribute('onclick') && allButtons[i].getAttribute('onclick').indexOf('reply') !== -1) {
				return allButtons[i];
			}
			i++;
		}

		return null;
	};

	/**
	 * Based on the current URL, return a pageType of 'linklist', 'comment', etc. Return
	 * null for a page where the script should not execute.
	 *
	 * ChangeTip will need to behave differently (expect different DOM, etc) on a linklist
	 * page versus a comments page, so we want to detect the page type and behave accordingly.
	 *
	 * Logic taken from Reddit Enhancement Suite's core
	 * 
	 * @return {[type]} [description]
	 */
	module.getPageType = function() {
		var pageType = '',
			currURL = location.href.split('#')[0];
		if (module.profileRegex.test(currURL)) {
			pageType = 'profile';
		} else if ((module.commentsRegex.test(currURL)) || (module.friendsCommentsRegex.test(currURL))) {
			pageType = 'comments';
		} else if (module.inboxRegex.test(currURL)) {
			pageType = 'inbox';
		} else if (module.submitRegex.test(currURL)) {
			pageType = 'submit';
		} else if (module.prefsRegex.test(currURL)) {
			pageType = 'prefs';
		} else if (module.wikiRegex.test(currURL)) {
			pageType = 'wiki';
		} else {
			pageType = 'linklist';
		}
		return pageType;
	};

	// regex schemes taken from Reddit Enhancement Suite
	module.allRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\//i;
	module.commentsRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/[-\w\.\/]*\/comments/i;
	module.friendsCommentsRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/r\/friends\/*comments/i;
	module.inboxRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:r\/[-\w\.\/]+?\/)?message\//i;
	module.profileRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/user\/([-\w\.#=]*)\/?(?:comments)?\/?(?:\?(?:[a-z]+=[a-zA-Z0-9_%]*&?)*)?$/i;
	module.submitRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:[-\w\.\/]*\/)?submit\/?(?:\?.*)?$/i;
	module.prefsRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/prefs/i;
	module.wikiRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:r\/[-\w\.]+\/)?wiki/i;
	module.searchRegex = /^https?:\/\/(?:[-\w\.]+\.)?reddit\.com\/(?:[-\w\.\/]*\/)?search/i;

});