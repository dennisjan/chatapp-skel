/**
 * ChatApp namespace
 * =================
 *
 * The ChatApp namespace contains all the other objects in this
 * application.
 */
window.ChatApp = { };

jQuery.fn.sortElements = (function(){

    var sort = [].sort;

    return function(comparator, getSortable) {

        getSortable = getSortable || function(){return this;};

        var placements = this.map(function(){

            var sortElement = getSortable.call(this),
                parentNode = sortElement.parentNode,

                // Since the element itself will change position, we have
                // to have some way of storing its original position in
                // the DOM. The easiest way is to have a 'flag' node:
                nextSibling = parentNode.insertBefore(
                    document.createTextNode(''),
                    sortElement.nextSibling
                );

            return function() {

                if (parentNode === this) {
                    throw new Error(
                        "You can't sort elements if any one is a descendant of another."
                    );
                }

                // Insert before flag:
                parentNode.insertBefore(this, nextSibling);
                // Remove flag:
                parentNode.removeChild(nextSibling);

            };

        });

        return sort.call(this, comparator).each(function(i){
            placements[i].call(getSortable.call(this));
        });

    };

})();

/**
 * The server to connect to
 */
window.ChatApp.serverUri = 'http://10.0.1.114:8080/';

/**
 * Message Model
 * ===================
 *
 * The message model represents a single message.
 * Messages have the following attributes:
 *   - nickName
 *   - gravatar
 *   - message
 *   - dateTime
 */
window.ChatApp.Message = Backbone.Model.extend({

});

/**
 * Message Collection 
 * ===================
 *
 * The messages collection contains the list of messages.
 */
window.ChatApp.MessageCollection = Backbone.Collection.extend({
    
    model: ChatApp.Message

});

/**
 * User Model
 * ==========
 *
 * The users model represents a single (online) user.
 * Users have the following attributes:
 *   - nickName
 *   - gravatar
 */
window.ChatApp.User = Backbone.Model.extend({


});

/**
 * User Collection 
 * ===============
 *
 * The user collection contains the list of online users.
 */
window.ChatApp.UserCollection = Backbone.Collection.extend({
    
    model: ChatApp.User

});

/**
 * Connection
 * ==========
 *
 * The connection is responsible for connecting to the server, sending
 * messages and receiving events.
 *
 * To operate correctly, the following constructor arguments must be passed:
 *   - userCollection (an instance of ChatApp.UserCollection)
 *   - messageCollection (an instance of ChatApp.MessageCollection)
 *   - nickName (the current users' nickname)
 *   - email (the current users' email address)
 *   - serverUri (location of the chat server)
 */
window.ChatApp.Connection = function(userCollection, messageCollection, nickName, email, serverUri) {

    this.userCollection = userCollection;
    this.messageCollection = messageCollection;
    this.nickName = nickName;
    this.email = email;

    if (!serverUri) { 
        serverUri = 'http://localhost:8080/';
    }
    this.serverUri = serverUri;

    var self = this;
    this.join(function() {
        self.listen();
    });

};
/**
 * Extending the Backbone 'Events' object
 */
_.extend(window.ChatApp.Connection.prototype, Backbone.Events, {

    userCollection : null,
    messageCollection : null,
    lastSequence : 0,

    /**
     * Calling the listen function will open up a long-polling connection to
     * the chat server.
     */
    listen : function() {

        var self = this;

        /**
         * The HTTP long polling request, using jQuery's ajax function
         */
        $.ajax(this.serverUri + 'eventpoll?since=' + this.lastSequence + '&nickName=' + this.nickName + '&email=' + this.email, {
            dataType : 'json',
            complete : function(jqXHR, textStatus) {
                self.listen();
            },
            success : function(data) {
                self.parseEvents(data);
            }
        });
    },

    /**
     * Calling the join function will let the server know we're here, and cause
     * the current user to be added to the userlist.
     */
    join : function(onSuccess) {

        $.ajax(this.serverUri + 'join?nickName=' + this.nickName + '&email=' + this.email, { success: onSuccess });

    },

    /**
     * The message function sends a chat-message to the server
     */
    message : function(message) {

        $.ajax(this.serverUri + 'message?nickName=' + this.nickName + '&email=' + this.email + '&message=' + message);

    },

    /**
     * parseEvent is called by listen. This function loops through a list of
     * events and call the appropriate actions on the user and message
     * collection.
     */
    parseEvents : function(events) {

        for(var ii=0;ii<events.length;ii++) {
            var event = events[ii];
            this.lastSequence = event.sequence;
            switch(event.type) {

                case 'message' :
                    console.log('MESSAGE: ' + event.nickName);
                    this.messageCollection.add({
                        message : event.message,
                        nickName : event.nickName,
                        dateTime : window.ChatApp.parseISO8601(event.dateTime),
                        gravatar : event.gravatar
                    });
                    break;

                case 'join' :
                    console.log('JOIN: ' + event.nickName);
                    this.userCollection.add({
                        nickName : event.nickName,
                        gravatar : event.gravatar
                    });
                    break;

                case 'part' :
                    console.log('PART: ' + event.nickName);
                    this.userCollection.remove(
                        this.userCollection.find(
                            function(item) { return item.get('nickName') === event.nickName; }
                        )
                    );
                    break;
                
                default :
                    console.log('Unknown event: ' + event.type);
                    break;

            }
        }

    }


});

/**
 * Parse a UTC date in ISO 8601 format to a Date object.
 *
 * Because ISO 8601 is not officially supported (and doesnt work in latest Safari).
 *
 * @url http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/
 *
 * @param String str
 */
window.ChatApp.parseISO8601 = function(str) {
    var parts = str.split('T'),
        dateParts = parts[0].split('-'),
        timeParts = parts[1].split('Z'),
        timeSubParts = timeParts[0].split(':'),
        timeSecParts = timeSubParts[2].split('.'),
        timeHours = Number(timeSubParts[0]),
        _date = new Date;

    _date.setUTCFullYear(Number(dateParts[0]));
    _date.setUTCMonth(Number(dateParts[1])-1);
    _date.setUTCDate(Number(dateParts[2]));
    _date.setUTCHours(Number(timeHours));
    _date.setUTCMinutes(Number(timeSubParts[1]));
    _date.setUTCSeconds(Number(timeSecParts[0]));
    if (timeSecParts[1]) {
        _date.setUTCMilliseconds(Number(timeSecParts[1]));
    }

    // by using setUTC methods the date has already been converted to local time(?)
    return _date;
};

/** Your code goes here! **/
/**
 * MessageList view
 * ================
 *
 * This view is responsible for updating the list of messages.
 * You must pass a 'collection' option, which should be an instance of
 * MessageCollection
 */
window.ChatApp.MessageListView = Backbone.View.extend({
    initialize : function() {
        var self = this;
        this.collection.bind('add', function(message) {
           self.addMessage(message);
        });
    },

    addMessage : function (message) {
        var messageEl = this.$('.template').clone();
        messageEl.removeClass('template');
        //username
        messageEl.find('div').text(message.get('nickName'));
        //tijd
        messageEl.find('time').text(message.get('dateTime').toTimeString());
        //message
        messageEl.find('p').text(message.get('message'));
        // gravatar
        messageEl.css({
           backgroundImage: "url('" + message.get('gravatar') + "?s=55&d=retro')"
        });
        
        this.el.find('ul').append(messageEl);
    }
});


/**
 * MessageInput view
 * ================
 *
 * This view is responsible for the 'input' area, which allows the user to
 * send a message to the chatroom.
 *
 * You must pass a 'connection' option, which should be an instance of
 * ChatApp.connection 
 */
window.ChatApp.MessageInputView = Backbone.View.extend({
    events : {
        "submit form" : "sendMessage"
    },

    sendMessage : function(evt) {

        evt.preventDefault();
        var message = this.$('input[name=message]').val();
        this.options.connection.message(message);
    }
});
    
/**
 * UserList view
 * ================
 *
 * This view is responsible for keeping the list of online users up to
 * date. 
 * You must pass a 'collection' option, which should be an instance of
 * UserCollection
 */
window.ChatApp.UserListView = Backbone.View.extend({
    initialize : function() {
        var self = this;
        this.collection.bind('add', function(user) {
           self.addUser(user);
        });
        this.collection.bind('remove', function(user) {
           self.removeUser(user);
        });
    },

    addUser : function(user) {
        var userEL = this.$('.template').clone();
        userEL.removeClass('template');
        userEL.text(user.get('nickName'));
        userEL.attr('class', 'nick-' + user.get('nickName'));
        // gravatar
        userEL.css({
           backgroundImage: "url('" + user.get('gravatar') + "?s=25&d=retro')"
        });
        this.el.append(userEL);
        this.$('li').sortElements(function(a, b){
            return $(a).text() > $(b).text() ? 1 : -1;
        });
   },

   removeUser : function(user) {
       $('.nick-' + user.get('nickName')).remove();
       this.$('li').sortElements(function(a, b){
            return $(a).text().toLowerCase() > $(b).text().toLowerCase() ? 1 : -1;
        });
   }

});

/**
 * The WelcomeView is responsible for handling the login screen
 */
window.ChatApp.WelcomeView = Backbone.View.extend({

    events : {
        "submit form" : "connect"
    },

    connect : function(evt) {

        evt.preventDefault();
        this.el.hide();
        var nickName = this.$('input[name=nickName]').val();
        var email = this.$('input[name=email]').val();

        this.trigger('connect', {
            nickName : nickName,
            email : email
        });

    }

});

/**
 * The Application View
 * ====================
 *
 * The Application View is basically the main Application controller, and
 * is responsible for setting up all the other objects.
 */
window.ChatApp.Application = Backbone.View.extend({

    messageCollection : null,
    userCollection : null,

    messageListView : null,
    messageInputView : null,
    userListView : null,
    welcomeView : null,

    connection : null,

    nickName : null,
    email : null,

    el: 'body',

    initialize : function() {

        var self = this;

        this.messageCollection = new ChatApp.MessageCollection();
        this.userCollection = new ChatApp.UserCollection();



        this.welcomeView = new ChatApp.WelcomeView({
            el : this.$('section.welcome')
        });
        this.welcomeView.bind('connect', function(userInfo) {
            self.nickName = userInfo.nickName;
            self.email = userInfo.email;
            self.initializeConnection();
        });

    },

    initializeConnection : function() {

        this.connection = new ChatApp.Connection(this.userCollection, this.messageCollection, this.nickName, this.email, ChatApp.serverUri);

        this.messageListView = new ChatApp.MessageListView({
            collection: this.messageCollection,
            el : this.$('section.messages')
        });
        this.messageInputView = new ChatApp.MessageInputView({
            connection: this.connection,
            el: this.$('section.inputArea')
        }); 
        this.userListView = new ChatApp.UserListView({
            collection: this.userCollection,
            el: this.$('section.userList')
        });


    }

});



/**
 * Using jQuery's DOM.ready to fire up the application.
 */
$(document).ready(function() {

    window.ChatApp.application = new ChatApp.Application;


});
