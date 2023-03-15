console.log('START FILE');

var debug;

$(function() {
  // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
  // // The Firebase SDK is initialized and available here!
  //
  // firebase.auth().onAuthStateChanged(user => { });
  // firebase.database().ref('/path/to/ref').on('value', snapshot => { });
  // firebase.firestore().doc('/foo/bar').get().then(() => { });
  // firebase.functions().httpsCallable('yourFunction')().then(() => { });
  // firebase.messaging().requestPermission().then(() => { });
  // firebase.storage().ref('/path/to/ref').getDownloadURL().then(() => { });
  // firebase.analytics(); // call to activate
  // firebase.analytics().logEvent('tutorial_completed');
  // firebase.performance(); // call to activate
  //
  // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥

  try {
    let app = firebase.app();
    let features = [
      'auth',
      'database',
      'firestore',
      'functions',
      'messaging',
      'storage',
      'analytics',
      'remoteConfig',
      'performance',
    ].filter(feature => typeof app[feature] === 'function');
    console.log(`Firebase SDK loaded with ${features.join(', ')}`);

    renderRsvpUi();
  } catch (e) {
    console.error(e);
    console.log('Error loading the Firebase SDK, check the console.');
  }
});

async function renderRsvpUi() {
  //jQuery
  const guestbookContainer = $('#guestbook-container');
  const startRsvpButton = $('#startRsvp');
  const form = $('#leave-message');
  const input = $('#message');
  const guestbook = $('#guestbook');
  const numberAttending = $('#number-attending');
  const rsvpYes = $('#rsvp-yes');
  const rsvpNo = $('#rsvp-no');

  let rsvpListener = null;
  let guestbookListener = null;

  let auth = firebase.auth();
  let db = firebase.firestore();

  // FirebaseUI config
  const uiConfig = {
    credentialHelper: firebaseui.auth.CredentialHelper.NONE,
    signInOptions: [
      // Email / Password Provider.
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
    ],
    callbacks: {
      signInSuccessWithAuthResult: function (authResult, redirectUrl) {
        // Handle sign-in.
        // Return false to avoid redirect.
        console.log("SIGN IN SUCCESS");
        return false;
      },
      signInFailure: function(error) {
        console.log("SIGN IN FAILED! " + JSON.stringify(error));
      }
    },
  };

  //FirebaseUI initialization statement
  const ui = new firebaseui.auth.AuthUI(auth);
  // Listen to RSVP button clicks
  startRsvpButton.click(function() {
    if (auth.currentUser) {
      // User is signed in; allows user to sign out
      firebase.auth().signOut();
    } else {
      // No user is signed in; allows user to sign in
      ui.start('#firebaseui-auth-container', uiConfig);
    }
  });

  // Listen to the current Auth state
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      startRsvpButton.text('LOGOUT');
      // Show guestbook to logged-in users
      guestbookContainer.show();

      // Subscribe to the guestbook collection
      subscribeGuestbook();
      // Subcribe to the user's RSVP
      subscribeCurrentRSVP(user);
    } else {
      startRsvpButton.text('RSVP');
      // Hide guestbook for non-logged-in users
      guestbookContainer.hide();
      // Unsubscribe from the guestbook collection
      unsubscribeGuestbook();
      // Unsubscribe from the guestbook collection
      unsubscribeCurrentRSVP();
    }
  });

  // Listen to the form submission
  form.submit(function( event ) {
    // Prevent the default form redirect
    event.preventDefault();

    let message = input.val();
    if (!message) {
      // Empty message - do nothing.
      return false;
    } 

    // Write a new message to the database collection "guestbook"
    db.collection("guestbook").add({
      text: message,
      timestamp: Date.now(),
      name: auth.currentUser.displayName,
      userId: auth.currentUser.uid,
    })
    .then((docRef) => {
        console.log("RSVP added with ID: ", docRef.id);
    })
    .catch((error) => {
        console.error("Failed to add RSVP: ", error);
    });

    // clear message input field
    input.val('');
    // Return false to avoid redirect
    return false;
  });

  // Create query for messages // Listen to guestbook updates
  function subscribeGuestbook() {
    db
      .collection('guestbook')
      .orderBy("timestamp", "desc")
      .onSnapshot((querySnapshot) => {
          // Reset page
          guestbook.html('');
          // For every RSVP in DB, show a paragraph on webpage.
          querySnapshot.forEach((doc) => {
            // doc.data() is never undefined for query doc snapshots
            console.log(`Showing' guestbook entry ${doc.id}  =>  ${doc.data()}`);
            guestbook.append(`<p>${doc.data().name + ': ' + doc.data().text}</p>`);
          });
       });
  }

  // Unsubscribe from guestbook updates
  function unsubscribeGuestbook() {
    if (guestbookListener != null) {
      guestbookListener();
      guestbookListener = null;
    }
  }

  // Listen to RSVP responses
  rsvpYes.click(async () => {
    // Get a reference to the user's document in the attendees collection
    const userRef = db.collection('attendees').doc(auth.currentUser.uid);

    // If they RSVP'd yes, save a document with attendi()ng: true
    try {
      await userRef.set({
        attending: true,
      });
    } catch (e) {
      console.error(`Error setting user RSVP to YES: ${e}`);
    }
  });
  rsvpNo.click(async () => {
    // Get a reference to the user's document in the attendees collection
    const userRef = db.collection('attendees').doc(auth.currentUser.uid);

    // If they RSVP'd yes, save a document with attending: true
    try {
      await userRef.set({
        attending: false,
      });
    } catch (e) {
      console.error(`Error setting user RSVP to NO: ${e}`);
    }
  });

// Update RSVP counter whenever ppl rsvp.
  db
    .collection('attendees')
    .where('attending', '==', true)
    .onSnapshot((attendingQuery) => {
      const newAttendeeCount = attendingQuery.docs.length;
      debug = attendingQuery;
      console.log('Number attendees changed to ' + newAttendeeCount);
      if (newAttendeeCount == 1) {
        numberAttending.text(newAttendeeCount + ' person going');
      } else {
        numberAttending.text(newAttendeeCount + ' people going');
      }
    });

  // Listen for attendee list
  function subscribeCurrentRSVP(user) {
    db
      .collection('attendees')
      .doc(user.uid)
      .onSnapshot((doc) => {
        console.log("User rsvp changed: ", doc.data());
        if (doc && doc.data()) {
          const attendingResponse = doc.data().attending;
          // Update css classes for buttons
          if (attendingResponse) {
            rsvpYes.addClass('clicked');
            rsvpNo.removeClass('clicked');
          } else {
            rsvpYes.removeClass('clicked');
            rsvpNo.addClass('clicked');
          }
        }
    });
  }

  function unsubscribeCurrentRSVP() {
    if (rsvpListener != null) {
      rsvpListener();
      rsvpListener = null;
    }
    rsvpYes.className = '';
    rsvpNo.className = '';
  }
}
