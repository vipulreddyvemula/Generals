import json

new_problems = [
{"c":1807,"i":"A","n":"Plus or Minus","r":800,"s":82417,"d":"Div4","b":0,"l":50},
{"c":1829,"i":"A","n":"Love Story","r":800,"s":68880,"d":"Div4","b":0,"l":50},
{"c":2086,"i":"A","n":"Cloudberry Jam","r":800,"s":33048,"d":"Educational","b":0,"l":50},
{"c":1877,"i":"A","n":"Goals of Victory","r":800,"s":48766,"d":"Div2","b":0,"l":50},
{"c":1742,"i":"A","n":"Sum","r":800,"s":100857,"d":"Div4","b":0,"l":50},
{"c":1850,"i":"A","n":"To My Critics","r":800,"s":72424,"d":"Div4","b":0,"l":50},
{"c":1899,"i":"A","n":"Game with Integers","r":800,"s":87012,"d":"Div3","b":0,"l":50},
{"c":1915,"i":"A","n":"Odd One Out","r":800,"s":77319,"d":"Div4","b":0,"l":50},
{"c":1692,"i":"A","n":"Marathon","r":800,"s":83662,"d":"Div4","b":0,"l":50},
{"c":1760,"i":"A","n":"Medium Number","r":800,"s":77493,"d":"Div4","b":0,"l":50},
{"c":1453,"i":"A","n":"Cancel the Trains","r":800,"s":23851,"d":"Div2","b":0,"l":50},
{"c":1482,"i":"A","n":"Prison Break","r":800,"s":21158,"d":"Other","b":0,"l":50},
{"c":1433,"i":"A","n":"Boring Apartments","r":800,"s":61492,"d":"Div3","b":0,"l":50},
{"c":1624,"i":"A","n":"Plus One on the Subset","r":800,"s":59412,"d":"Div3","b":0,"l":50},
{"c":1772,"i":"A","n":"A+B?","r":800,"s":59105,"d":"Div3","b":0,"l":50},
{"c":1731,"i":"A","n":"Joey Takes Money","r":800,"s":23588,"d":"Div2","b":0,"l":50},
{"c":1669,"i":"A","n":"Division?","r":800,"s":85864,"d":"Div4","b":0,"l":50},
{"c":1579,"i":"A","n":"Casimir's String Solitaire","r":800,"s":41668,"d":"Div3","b":0,"l":50},
{"c":1608,"i":"A","n":"Find Array","r":800,"s":20151,"d":"Div2","b":0,"l":50},
{"c":1654,"i":"A","n":"Maximum Cake Tastiness","r":800,"s":19337,"d":"Div2","b":0,"l":50},
{"c":1567,"i":"A","n":"Domino Disaster","r":800,"s":31577,"d":"Div2","b":0,"l":50},
{"c":2065,"i":"A","n":"Skibidus and Amog'u","r":800,"s":54331,"d":"Div4","b":0,"l":50},
{"c":2162,"i":"A","n":"Beautiful Average","r":800,"s":40273,"d":"Div3","b":0,"l":50},
{"c":1409,"i":"A","n":"Yet Another Two Integers Problem","r":800,"s":78882,"d":"Div3","b":0,"l":50},
{"c":1999,"i":"A","n":"A+B Again?","r":800,"s":81236,"d":"Div4","b":0,"l":50},
{"c":1758,"i":"A","n":"SSeeeeiinngg DDoouubbllee","r":800,"s":26677,"d":"Div2","b":0,"l":50},
{"c":1791,"i":"A","n":"Codeforces Checking","r":800,"s":78300,"d":"Div4","b":0,"l":50},
{"c":2044,"i":"A","n":"Easy Problem","r":800,"s":59304,"d":"Div4","b":0,"l":50},
{"c":2167,"i":"A","n":"Square?","r":800,"s":54810,"d":"Div4","b":0,"l":50},
{"c":1535,"i":"A","n":"Fair Playoff","r":800,"s":56391,"d":"Educational","b":0,"l":50},
{"c":1996,"i":"A","n":"Legs","r":800,"s":56052,"d":"Div3","b":0,"l":50},
{"c":1703,"i":"A","n":"YES or YES?","r":800,"s":94505,"d":"Div4","b":0,"l":50},
{"c":47,"i":"A","n":"Triangular numbers","r":800,"s":18676,"d":"div2","b":0,"l":50},
{"c":9,"i":"A","n":"Die Roll","r":800,"s":72747,"d":"div2","b":0,"l":50},
{"c":4,"i":"A","n":"Watermelon","r":800,"s":727840,"d":"div2","b":0,"l":50},
{"c":1,"i":"A","n":"Theatre Square","r":1000,"s":313288,"d":"other","b":0,"l":100},
{"c":1352,"i":"A","n":"Sum of Round Numbers","r":800,"s":109635,"d":"div4","b":0,"l":150},
{"c":1335,"i":"A","n":"Candies and Two Sisters","r":800,"s":109037,"d":"div3","b":0,"l":50},
{"c":1328,"i":"A","n":"Divisibility Problem","r":800,"s":138411,"d":"div3","b":0,"l":50},
{"c":1294,"i":"A","n":"Collecting Coins","r":800,"s":54909,"d":"div3","b":0,"l":50},
{"c":510,"i":"A","n":"Fox And Snake","r":800,"s":110861,"d":"div2","b":0,"l":50},
{"c":520,"i":"A","n":"Pangram","r":800,"s":133654,"d":"div2","b":0,"l":50},
{"c":617,"i":"A","n":"Elephant","r":800,"s":263576,"d":"div2","b":0,"l":50},
{"c":1977,"i":"A","n":"Little Nikita","r":800,"s":39958,"d":"div2","b":0,"l":100},
{"c":2149,"i":"A","n":"Be Positive","r":800,"s":43364,"d":"div3","b":0,"l":50},
{"c":2093,"i":"A","n":"Ideal Generator","r":800,"s":41786,"d":"div3","b":0,"l":100},
{"c":2044,"i":"C","n":"Hard Problem","r":800,"s":46567,"d":"div4","b":0,"l":50},
{"c":1676,"i":"B","n":"Equal Candies","r":800,"s":62824,"d":"div4","b":0,"l":50},
{"c":1742,"i":"B","n":"Increasing","r":800,"s":63564,"d":"div4","b":0,"l":50},
{"c":1829,"i":"B","n":"Blank Space","r":800,"s":85939,"d":"div4","b":0,"l":50},
{"c":1873,"i":"B","n":"Good Kid","r":800,"s":None,"d":"div4","b":0,"l":50},
{"c":472,"i":"A","n":"Design Tutorial: Learn from Math","r":800,"s":None,"d":"other","b":0,"l":100},
{"c":1985,"i":"B","n":"Maximum Multiple Sum","r":800,"s":None,"d":"div4","b":0,"l":100},
{"c":630,"i":"A","n":"Again Twenty Five!","r":800,"s":None,"d":"other","b":0,"l":50},
{"c":2148,"i":"A","n":"Sublime Sequence","r":800,"s":None,"d":"div4","b":0,"l":50},
{"c":1992,"i":"A","n":"Only Pluses","r":800,"s":None,"d":"div3","b":0,"l":100},
{"c":1986,"i":"A","n":"X Axis","r":800,"s":None,"d":"div3","b":0,"l":50},
{"c":1941,"i":"A","n":"Rudolf and the Ticket","r":800,"s":None,"d":"div3","b":0,"l":100},
{"c":935,"i":"A","n":"Fafa and his Company","r":800,"s":None,"d":"div3","b":0,"l":50},
{"c":2193,"i":"A","n":"DBMB and the Array","r":800,"s":None,"d":"div3","b":0,"l":50},
{"c":509,"i":"A","n":"Maximum in Table","r":800,"s":None,"d":"other","b":0,"l":100},
{"c":2218,"i":"A","n":"The 67th Integer Problem","r":800,"s":None,"d":"div4","b":0,"l":50},
{"c":214,"i":"A","n":"System of Equations","r":800,"s":None,"d":"div2","b":0,"l":100},
{"c":1872,"i":"A","n":"Two Vessels","r":800,"s":None,"d":"div3","b":0,"l":50},
{"c":2060,"i":"A","n":"Fibonacciness","r":800,"s":None,"d":"div3","b":0,"l":100},
{"c":1968,"i":"A","n":"Maximize?","r":800,"s":None,"d":"div3","b":0,"l":50},
{"c":2121,"i":"A","n":"Letter Home","r":800,"s":None,"d":"div3","b":0,"l":50},
{"c":2171,"i":"A","n":"Shizuku Hoshikawa and Farm Legs","r":800,"s":None,"d":"div3","b":0,"l":100},
{"c":2008,"i":"C","n":"Longest Good Array","r":800,"s":None,"d":"div3","b":0,"l":50},
{"c":1691,"i":"A","n":"Beat The Odds","r":800,"s":None,"d":"div2","b":0,"l":50},
{"c":894,"i":"A","n":"QAQ","r":800,"s":None,"d":"div2","b":0,"l":100},
{"c":734,"i":"B","n":"Anton and Digits","r":800,"s":None,"d":"div2","b":0,"l":50},
{"c":1709,"i":"A","n":"Three Doors","r":800,"s":None,"d":"div2","b":0,"l":100},
{"c":1920,"i":"A","n":"Satisfying Constraints","r":800,"s":None,"d":"div2","b":0,"l":50},
{"c":231,"i":"A","n":"Team","r":800,"s":None,"d":"Div2","b":0,"l":50},
{"c":546,"i":"A","n":"Soldier and Bananas","r":800,"s":None,"d":"Div2","b":0,"l":50},
{"c":155,"i":"A","n":"I_love_%username%","r":800,"s":None,"d":"Div2","b":0,"l":100},
{"c":2009,"i":"A","n":"Minimize!","r":800,"s":None,"d":None,"b":0,"l":50},
{"c":732,"i":"A","n":"Buy a Shovel","r":800,"s":None,"d":"Div2","b":0,"l":100},
{"c":1853,"i":"A","n":"Desorting","r":800,"s":None,"d":"Div2","b":0,"l":100},
{"c":1788,"i":"A","n":"One and Two","r":800,"s":None,"d":"Div2","b":0,"l":50},
{"c":2126,"i":"A","n":"Only One Digit","r":800,"s":None,"d":"Div3","b":0,"l":100},
{"c":1766,"i":"A","n":"Extremely Round","r":800,"s":None,"d":"Div2","b":0,"l":50},
{"c":1520,"i":"B","n":"Ordinary Numbers","r":800,"s":None,"d":"Div3","b":0,"l":100}
]

problems_file = '/home/vipul-reddy/projects/Generals/server/data/problems.json'
with open(problems_file, 'r') as f:
    existing_problems = json.load(f)

# Track existing ones to avoid duplicates
existing_map = {}
for i, p in enumerate(existing_problems):
    key = f"{p['c']}_{p['i']}"
    existing_map[key] = i

duplicates = []
added = 0
updated = 0

for p in new_problems:
    key = f"{p['c']}_{p['i']}"
    if key in existing_map:
        duplicates.append(key)
        # Update the existing problem
        idx = existing_map[key]
        # Preserve original 's' if new is None
        if p.get('s') is None and 's' in existing_problems[idx]:
            p['s'] = existing_problems[idx]['s']
        if p.get('d') is None and 'd' in existing_problems[idx]:
            p['d'] = existing_problems[idx]['d']
            
        existing_problems[idx] = p
        updated += 1
    else:
        existing_problems.append(p)
        added += 1

# Now sort based on clist rating 'l' (using 0 if missing)
existing_problems.sort(key=lambda x: x.get('l', 0))

# Recalculate clistBand ('b') for all problems to ensure correctness
for p in existing_problems:
    l = p.get('l', -1)
    if l < 0:
        p['b'] = -1
    elif l <= 200:
        p['b'] = 0
    elif l <= 600:
        p['b'] = 1
    elif l <= 1000:
        p['b'] = 2
    elif l <= 1500:
        p['b'] = 3
    else:
        p['b'] = 4

with open(problems_file, 'w') as f:
    json.dump(existing_problems, f, indent=2)

print(f"Added: {added}")
print(f"Updated: {updated}")
print(f"Duplicates encountered: {len(duplicates)}")

