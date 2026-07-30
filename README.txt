HANDLELISTE MED FIREBASE – ENKEL OPSÆTNING

Appen består kun af HTML, CSS og JavaScript. Den kan derfor hostes gratis på GitHub Pages eller Firebase Hosting. PHP og webhotel er ikke nødvendigt.

DEL 1 – OPRET FIREBASE
1. Gå til Firebase Console og tryk "Create a project".
2. Giv projektet et navn. Google Analytics kan springes over.
3. Tryk på web-ikonet </> under projektoversigten.
4. Giv webappen et navn og tryk "Register app".
5. Firebase viser en firebaseConfig med apiKey, authDomain, projectId osv.
6. Åbn filen firebase-config.js i denne mappe.
7. Erstat alle værdier, der starter med INDSAET_, med værdierne fra Firebase.

DEL 2 – OPRET FIRESTORE
1. Åbn "Build" → "Firestore Database" i Firebase Console.
2. Tryk "Create database".
3. Vælg en europæisk placering, eksempelvis europe-west.
4. Vælg Production mode. Reglerne indsættes i næste trin.
5. Åbn fanen "Rules".
6. Kopiér hele indholdet fra filen firestore.rules ind i editoren.
7. Tryk "Publish".

VIGTIGT OM REGLERNE
De medfølgende regler er lavet for at gøre testen enkel. Alle, der kender webadressen, kan læse og ændre listen. Brug ikke denne regel til følsomme oplysninger. Senere kan appen udvides med login eller en hemmelig familiekode.

DEL 3 – TEST LOKALT
Du må ikke dobbeltklikke direkte på index.html, fordi browserens file://-tilstand kan blokere moduler.

Nem metode med Visual Studio Code:
1. Installér udvidelsen "Live Server".
2. Højreklik på index.html.
3. Vælg "Open with Live Server".

Alternativt med Python fra mappen:
python -m http.server 8000
Åbn derefter http://localhost:8000

DEL 4 – GITHUB PAGES
1. Opret et nyt repository på GitHub.
2. Upload alle filerne fra handleliste-app-mappen til roden af repositoryet.
3. Åbn repositoryets Settings → Pages.
4. Under "Build and deployment" vælges "Deploy from a branch".
5. Vælg branch "main" og mappen "/ (root)".
6. Gem og åbn den adresse GitHub viser.

FIREBASE-PRIS
Firebase har en gratis Spark-plan. En lille privat handleliste vil normalt ligge langt under de gratis Firestore-grænser. Du behøver normalt ikke tilføje et betalingskort til denne version. Ved meget høj trafik eller brug af betalte funktioner kan en opgradering blive nødvendig.

FILER
- index.html: Sidens opbygning.
- style.css: Det hvide minimalistiske design.
- app.js: Søgning og Firestore-synkronisering.
- firebase-config.js: Her indsætter du din Firebase-konfiguration.
- firestore.rules: Regler, som skal indsættes i Firestore.
- products.json: Katalog med 1.000 produkter.
