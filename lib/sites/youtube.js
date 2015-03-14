addModule('youtube', function(module, moduleID) {
	module.moduleName = 'YouTube';
	module.category = 'Site Modules';

	module.init = function() {
		if (location.hostname === 'apis.google.com') {
			$("body").delegate("div.df.editable", "blur focus", module.handleEditorFocus);
			$("body").delegate("div.Kv.RN.SEa", "click", module.getUsernameFromReplyButton);

			// set up a listener for a message from the background page providing user info
			chrome.runtime.onMessage.addListener(
				function(request, sender, sendResponse) {
					if (request.mainUsername) {
						module.mainUsername = request.mainUsername;
					}
					if (request.mainAvatar) {
						module.mainAvatar = request.mainAvatar;
					}
					if (request.mainOid) {
						module.mainOid = request.mainOid;
					}
				}
			);

			// when the iframe loads, send a request to the background page for the original
			// user ID, which we'll have to scrape off of the main page.
			BabelExt.bgMessage({
				requestType: "requestUserInfo"
			});


		} else if ((location.hostname === 'www.youtube.com') && (location.pathname.indexOf('embed') === -1)) {
			var me = this;
			// set up a listener for a message from the background page requesting this info.
			chrome.runtime.onMessage.addListener(
				function(request, sender, sendResponse) {
					if (request.requestType === 'requestUserInfo') {
						me.scrapeUserInfo();
						BabelExt.bgMessage({
							requestType: "returnUserInfo",
							mainUsername: module.mainUsername,
							mainAvatar: module.mainAvatar,
							mainOid: module.mainOid
						});
					}
				}
			);
		}
	};

	module.scrapeUserInfo = function() {
		var $gplusLink, gplusURL;
		// scrape the user ID and name off of the main page for replies.
		module.mainUsername = $('#watch-header .yt-user-info a').text();
		$gplusLink = $('link[href*="plus.google.com"]');
		if (!$gplusLink.length) {
			$gplusLink = $('a[href*="plus.google.com"]');
		}
		gplusURL = $gplusLink.attr('href').split('/');
		module.mainOid = gplusURL[gplusURL.length-1];

		// it's possible a race condition could exist where data-thumb has already been removed
		// and has been converted to the src attribute, so we need to check both.
		module.mainAvatar = $('#watch-header .yt-thumb-clip img').attr('data-thumb');
		if (module.mainAvatar === '') {
			module.mainAvatar = $('#watch-header .yt-thumb-clip img').attr('src');
		}
	};

	// the string used to mention changetip on this medium
	module.ctMentionString = '+ChangeTip';

	module.handleEditorFocus = function(e) {
		var tipButton, isTopLevel,
			commentsContainer;

		if (e.type === 'focus') {
			commentsContainer = $(e.target).closest('.zPa.g9');
			isTopLevel = commentsContainer.length < 1;
			if (!e.currentTarget.parentNode.classList.contains('changetip-enabled')) {
				if (isTopLevel) {
					// this is a top level button, use our magically acquired username/oid/avatar info from
					// our crazy iframe message passing.
					module.attachButtonToTextarea(e.currentTarget, module.mainUsername, module.mainAvatar, module.mainOid);
				} else {
					module.attachButtonToTextarea(e.currentTarget);
				}
			} else {
				// if this textarea is not top levle, and already has a button, let's update the
				// username/avatar/oid based on the last clicked reply button.
				if (!isTopLevel) {
					// we don't need to add a new button, but we do need to update the avatar/username.
					tipButton = e.currentTarget.parentNode.querySelector('.changetip-textarea-button');
					tipButton.setAttribute('data-username', module.replyUsername);
					tipButton.setAttribute('data-avatar', module.replyAvatar);
					tipButton.setAttribute('data-oid', module.replyOid);
				}
			}

			// show the ChangeTip button in case we've hidden it from a blur event
			$(e.currentTarget).parent().find('.changetip-textarea-button').show();
		} else {
			// hide the ChangeTip button if unfocused, because it looks misplaced in that state
			// there are issues w/this, though, as we need to check state of the ChangeTip dialog, etc.
			//
			// TODO: consider ditching this timeout and finding something cleaner.
			// setTimeout(function() {
			// 	if (!ChangeTip.dialogIsOpen) {
			// 		$(e.target).parent().find('.changetip-textarea-button').hide();
			// 	}
			// }, 100);
		}
	};

	/**
	 * YouTube's reply action is strange. The textarea you're led to in order to write your comment
	 * is in the same spot whether you're replying to a top level comment or a reply to a top level
	 * comment. For that reason, we'll need to ascertain the username from the last reply button that
	 * was clicked.
	 */
	module.getUsernameFromReplyButton = function(e) {
		var parent;

		// replies to replies...
		parent = $(e.target).closest('.Wi.lg.via');
		if (!parent.length) {
			// top level replies...
			parent = $(e.target).closest('.ve.oba.HPa');
		}
		module.replyOid = $(parent).find('a[oid]').attr('oid');
		module.replyUsername = $(parent).find('span.Ub').text();
		module.replyAvatar = $(parent).find('a img')[0].src;
	};

	module.attachButtonToTextarea = function(textarea, username, avatar, oid) {
		var parent = textarea.parentNode,
			tipButton,
			isBlock, marginBottom, marginLeft;

		if (!oid) {
			// get username and related data from last clicked reply button
			username = module.replyUsername;
			avatar = module.replyAvatar;
			oid = module.replyOid;
		}

		// TODO:
		// however, we should maybe also check the start of this field for an input type="button"
		// that contains an existing user mention, because that'd take precedence in case it was
		// auto populated by a reply.
		tipButton = module.createTipButton(username, avatar, oid);

		// save a reference to the textarea that we're attached to
		tipButton.textarea = textarea;

		tipButton.classList.add('youtube');

		// ensure this textarea's parent has position: relative or absolute so that
		// the tip button can be properly aligned. Fortunately, reddit has an empty
		// div around every textarea which serves perfectly as a container for us.
		parent.classList.add('changetip-enabled');
		parent.appendChild(tipButton);

	};

	module.createTipButton = function(username, avatar, oid) {
		var tipButton = Utils.createElement('a', null, 'changetip-button changetip-textarea-button');

		if (username === 'changetip') {
			return;
		}

		tipButton.textContent = 'ChangeTip';
		// remove from tabindex or it hijacks and makes "tab, enter" no longer work for submitting posts.
		tipButton.setAttribute('tabindex', '-1');
		tipButton.setAttribute('href','#tip');
		tipButton.setAttribute('data-username', username);
		tipButton.setAttribute('data-avatar', avatar);
		tipButton.setAttribute('data-oid', oid);
		tipButton.setAttribute('title', 'send a tip to ' + username);
		tipButton.addEventListener('click', module.tipViaTextarea, false);

		return tipButton;
	};

	module.tipViaTextarea = function(e) {
		var tipButton = e.target,
			username = tipButton.getAttribute('data-username'),
			avatar = tipButton.getAttribute('data-avatar'),
			oid = tipButton.getAttribute('data-oid'),
			pos = RESUtils.getXYpos(tipButton),
			fixed = false;

		if (!tipButton.textarea) {
			throw "ChangeTip Exception: comment textarea not found";
		}
		// if a top level textarea is empty, youtube destroys it upon blur, which
		// breaks the changetip button, so let's ensure we place a character in it.
		if (tipButton.textarea.textContent === '' && tipButton.textarea.textContent.length === 0) {
			tipButton.textarea.innerHTML = '&nbsp';
		}
		module.textarea = tipButton.textarea;

		ChangeTip.openDialog({
			x: pos.x,
			y: pos.y - 15,
			fixed: fixed,
			textarea: tipButton.textarea,
			amount: ChangeTip.getSetting('defaultAmount'),
			username: username,
			avatar: avatar,
			metadata: {
				oid: oid
			}
		});
		e.preventDefault();
		e.stopPropagation();
	};

	/**
	 * given a tip amount, return a message string to be appended
	 * to the comment reply box using ChangeTip.applyTipTemplate
	 *
	 * @return {string} message to be placed into comment box
	 */
	module.getTipMessage = function(tipAmount) {
		// here, we don't use the template because YouTube mentions can't be done in plaintext
		return 'have ' + tipAmount + ' on me! '; // we leave out ctMentionString because we need to append HTML here.
	};

	module.makeMentionToken = function(username, oid) {
		var mention = Utils.createElement('input', null, 'CfgfKe sk');
		mention.setAttribute('type', 'button');
		mention.setAttribute('value', '+'+username);
		mention.setAttribute('tabindex', '-1');
		mention.setAttribute('oid',oid);
		mention.setAttribute('data-token-entity','@'+oid);
		mention.setAttribute('data-token-displayname',username);
		mention.setAttribute('data-sbxm','1');
		return mention;
	};

	/**
	 * handle form submission from the ChangTip dialog - this function
	 * should call module.getTipMessage, and place that message in to
	 * the appropriate place
	 */
	module.submit = function(tipAmount) {
		var tipString = module.getTipMessage(tipAmount),
			textFrag = document.createDocumentFragment(),
			userMention = module.makeMentionToken(ChangeTip.toUsername, ChangeTip.metadata.oid),
			ctMention = module.makeMentionToken('ChangeTip', '109221733605802973929');

		// first, append the user mention if not already present
		if (!module.textarea.querySelector('input[oid="'+ChangeTip.metadata.oid+'"]')) {
			module.textarea.appendChild(userMention);
		}
		// append the tipString
		textFrag.textContent = ' ' + tipString;
		module.textarea.appendChild(textFrag);

		// append the changetip mention if not already present
		if (!module.textarea.querySelector('input[oid="109221733605802973929"]')) {
			module.textarea.appendChild(ctMention);
		}
	};

	/**
	 * If the onCancel function exists, the core changeTip dialog will
	 * call it when the dialog is cancelled
	 */
	module.onCancel = function() {
		module.textarea.focus();
	};

});