// Single source of truth for German administrative regions.
// Bundesländer + their Landkreise/kreisfreie Städte (294 districts per
// Wikipedia "Liste der Landkreise in Deutschland"). Every profile/setting
// (Shelter, Ward, Sentinel application) reads region options from here.

export const BUNDESLAENDER: string[] = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
];

export const LANDKREISE: Record<string, string[]> = {
  "Baden-Württemberg": ["Alb-Donau-Kreis", "Biberach", "Böblingen", "Bodenseekreis", "Breisgau-Hochschwarzwald", "Calw", "Emmendingen", "Enzkreis", "Esslingen", "Freudenstadt", "Göppingen", "Heidenheim", "Heilbronn", "Hohenlohekreis", "Karlsruhe", "Konstanz", "Lörrach", "Ludwigsburg", "Main-Tauber-Kreis", "Neckar-Odenwald-Kreis", "Ortenaukreis", "Ostalbkreis", "Rastatt", "Ravensburg", "Rems-Murr-Kreis", "Reutlingen", "Rhein-Neckar-Kreis", "Rottweil", "Schwäbisch Hall", "Schwarzwald-Baar-Kreis", "Sigmaringen", "Tübingen", "Tuttlingen", "Waldshut", "Zollernalbkreis"],
  "Bayern": ["Aichach-Friedberg", "Altötting", "Amberg-Sulzbach", "Ansbach", "Aschaffenburg", "Augsburg", "Bad Kissingen", "Bad Tölz-Wolfratshausen", "Bamberg", "Bayreuth", "Berchtesgadener Land", "Cham", "Coburg", "Dachau", "Deggendorf", "Dillingen an der Donau", "Dingolfing-Landau", "Donau-Ries", "Ebersberg", "Eichstätt", "Erding", "Erlangen-Höchstadt", "Forchheim", "Freising", "Freyung-Grafenau", "Fürstenfeldbruck", "Fürth", "Garmisch-Partenkirchen", "Günzburg", "Haßberge", "Hof", "Kelheim", "Kitzingen", "Kronach", "Kulmbach", "Landsberg am Lech", "Landshut", "Lichtenfels", "Lindau (Bodensee)", "Main-Spessart", "Miesbach", "Miltenberg", "Mühldorf am Inn", "München", "Neu-Ulm", "Neuburg-Schrobenhausen", "Neumarkt in der Oberpfalz", "Neustadt an der Aisch-Bad Windsheim", "Neustadt an der Waldnaab", "Nürnberger Land", "Oberallgäu", "Ostallgäu", "Passau", "Pfaffenhofen an der Ilm", "Regen", "Regensburg", "Rhön-Grabfeld", "Rosenheim", "Roth", "Rottal-Inn", "Schwandorf", "Schweinfurt", "Starnberg", "Straubing-Bogen", "Tirschenreuth", "Traunstein", "Unterallgäu", "Weilheim-Schongau", "Weißenburg-Gunzenhausen", "Wunsiedel im Fichtelgebirge", "Würzburg"],
  "Brandenburg": ["Barnim", "Dahme-Spreewald", "Elbe-Elster", "Havelland", "Märkisch-Oderland", "Oberhavel", "Oberspreewald-Lausitz", "Oder-Spree", "Ostprignitz-Ruppin", "Potsdam-Mittelmark", "Prignitz", "Spree-Neiße", "Teltow-Fläming", "Uckermark"],
  "Hessen": ["Bergstraße", "Darmstadt-Dieburg", "Fulda", "Gießen", "Groß-Gerau", "Hersfeld-Rotenburg", "Hochtaunuskreis", "Kassel", "Lahn-Dill-Kreis", "Limburg-Weilburg", "Main-Kinzig-Kreis", "Main-Taunus-Kreis", "Marburg-Biedenkopf", "Odenwaldkreis", "Offenbach", "Rheingau-Taunus-Kreis", "Schwalm-Eder-Kreis", "Vogelsbergkreis", "Waldeck-Frankenberg", "Werra-Meißner-Kreis", "Wetteraukreis"],
  "Mecklenburg-Vorpommern": ["Ludwigslust-Parchim", "Mecklenburgische Seenplatte", "Nordwestmecklenburg", "Rostock", "Vorpommern-Greifswald", "Vorpommern-Rügen"],
  "Niedersachsen": ["Ammerland", "Aurich", "Celle", "Cloppenburg", "Cuxhaven", "Diepholz", "Emsland", "Friesland", "Gifhorn", "Goslar", "Göttingen", "Grafschaft Bentheim", "Hameln-Pyrmont", "Hannover, Region", "Harburg", "Heidekreis", "Helmstedt", "Hildesheim", "Holzminden", "Leer", "Lüchow-Dannenberg", "Lüneburg", "Nienburg/Weser", "Northeim", "Oldenburg", "Osnabrück", "Osterholz", "Peine", "Rotenburg (Wümme)", "Schaumburg", "Stade", "Uelzen", "Vechta", "Verden", "Wesermarsch", "Wittmund", "Wolfenbüttel"],
  "Nordrhein-Westfalen": ["Aachen, Städteregion", "Borken", "Coesfeld", "Düren", "Ennepe-Ruhr-Kreis", "Euskirchen", "Gütersloh", "Heinsberg", "Herford", "Hochsauerlandkreis", "Höxter", "Kleve", "Lippe", "Märkischer Kreis", "Mettmann", "Minden-Lübbecke", "Oberbergischer Kreis", "Olpe", "Paderborn", "Recklinghausen", "Rhein-Erft-Kreis", "Rheinisch-Bergischer Kreis", "Rhein-Kreis Neuss", "Rhein-Sieg-Kreis", "Siegen-Wittgenstein", "Soest", "Steinfurt", "Unna", "Viersen", "Warendorf", "Wesel"],
  "Rheinland-Pfalz": ["Ahrweiler", "Altenkirchen (Westerwald)", "Alzey-Worms", "Bad Dürkheim", "Bad Kreuznach", "Bernkastel-Wittlich", "Birkenfeld", "Cochem-Zell", "Donnersbergkreis", "Eifelkreis Bitburg-Prüm", "Germersheim", "Kaiserslautern", "Kusel", "Mainz-Bingen", "Mayen-Koblenz", "Neuwied", "Rhein-Hunsrück-Kreis", "Rhein-Lahn-Kreis", "Rhein-Pfalz-Kreis", "Südliche Weinstraße", "Südwestpfalz", "Trier-Saarburg", "Vulkaneifel", "Westerwaldkreis"],
  "Saarland": ["Merzig-Wadern", "Neunkirchen", "Saarbrücken, Regionalverband", "Saarlouis", "Saarpfalz-Kreis", "St. Wendel"],
  "Sachsen": ["Bautzen", "Erzgebirgskreis", "Görlitz", "Leipzig", "Meißen", "Mittelsachsen", "Nordsachsen", "Sächsische Schweiz-Osterzgebirge", "Vogtlandkreis", "Zwickau"],
  "Sachsen-Anhalt": ["Altmarkkreis Salzwedel", "Anhalt-Bitterfeld", "Börde", "Burgenlandkreis", "Harz", "Jerichower Land", "Mansfeld-Südharz", "Saalekreis", "Salzlandkreis", "Stendal", "Wittenberg"],
  "Schleswig-Holstein": ["Dithmarschen", "Herzogtum Lauenburg", "Nordfriesland", "Ostholstein", "Pinneberg", "Plön", "Rendsburg-Eckernförde", "Schleswig-Flensburg", "Segeberg", "Steinburg", "Stormarn"],
  "Thüringen": ["Altenburger Land", "Eichsfeld", "Gotha", "Greiz", "Hildburghausen", "Ilm-Kreis", "Kyffhäuserkreis", "Nordhausen", "Saale-Holzland-Kreis", "Saale-Orla-Kreis", "Saalfeld-Rudolstadt", "Schmalkalden-Meiningen", "Sömmerda", "Sonneberg", "Unstrut-Hainich-Kreis", "Wartburgkreis", "Weimarer Land"],
  "Berlin": [],
  "Bremen": [],
  "Hamburg": [],
};
