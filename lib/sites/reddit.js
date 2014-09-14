addModule('reddit', function(module, moduleID) {
	module.moduleName = 'Reddit';
	module.category = 'Site Modules';

	module.init = function() {
		module.pageType = RESUtils.pageType();
		RESUtils.initObservers();
		RESUtils.watchForElement('newComments', module.handleComments);
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
	module.handleComments = function(ele) {
		var ele = ele || document.body,
			postUsername = ele.querySelector('a.author').textContent,
			postList,
			buttonLists,
			postTipButton;

		postList = ele.querySelector('.flat-list.buttons');

		if (postList) {
			postTipButton = module.createTipButton(postUsername);
			postList.appendChild(postTipButton);
		}

		// attach a button to each list of buttons
		buttonLists = ele.querySelectorAll('.comment .flat-list.buttons');

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
			replyButtonContainer, tipButtonContainer;

		// get the username of who this button will tip
		if (replyButton) {
			replyButtonContainer = replyButton.parentNode,
			tipButtonContainer = module.createTipButton(username, replyButton);

			// add our newly created button to the DOM
			if (tipButtonContainer) {
				list.insertBefore(tipButtonContainer, replyButtonContainer);
			}
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

});