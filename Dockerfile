FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Si tu veux bun au lieu de node, installe-le ici, sinon tu as déjà node 20+ dedans
# ENV bun_version=1.2.4
# RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app

COPY . .

# Installe les deps Node.js
RUN npm install

# (Optionnel si tu veux vérifier que les navigateurs sont là)
RUN npx playwright install --with-deps

CMD ["node", "index.js"] # Ou "bun index.ts" si tu installes bun
