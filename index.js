const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const app = new Koa();
const fs = require('fs');

app.use(async (ctx, next) => {
    try {
        await next();
        if (ctx.status >= 400 && ctx.body == null) {
            ctx.body = { error: ctx.message };
        }
    } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = {
            error: ctx.status < 500 ? err.message : 'Internal Server Error',
        };
    }
});

app.use(async (ctx, next) => {
    const debut = Date.now();
    await next();
    const fin = Date.now();
    console.log(`${ctx.method} ${ctx.path} - ${fin - debut}ms`);
  }
);

app.use(bodyParser({
    jsonLimit: '1mb',
    onerror: (err, ctx) => {
        const status = err.status === 413 || err.statusCode === 413 ? 413 : 400;
        ctx.throw(status, status === 413 ? 'Request body too large' : 'Invalid JSON body');
    },
}));

const router = new Router();

const path = './posts.seed.json';
const posts = JSON.parse(fs.readFileSync(path, 'utf8'));
let nextPostId = Math.max(...posts.map((post) => post.id)) + 1;

function validatePost(post, partiel = false) {
    if (post === null || typeof post !== 'object' || Array.isArray(post)) {
        return 'Le corps doit être un objet JSON.';
    }

    const fields = ['postId', 'name', 'email', 'body'];
    const unknownField = Object.keys(post).find((field) => !fields.includes(field));
    if (unknownField) {
        return `Le champ "${unknownField}" n'est pas autorisé.`;
    }

    if (partiel && Object.keys(post).length === 0) {
        return 'Au moins un champ doit être fourni.';
    }

    for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(post, field)) {
            if (!partiel) {
                return `Le champ "${field}" est obligatoire.`;
            }
            continue;
        }

        if (field === 'postId') {
            if (!Number.isInteger(post[field]) || post[field] < 1) {
                return 'Le champ "postId" doit être un entier positif.';
            }
        } else if (typeof post[field] !== 'string' || post[field].trim() === '') {
            return `Le champ "${field}" doit être une chaîne non vide.`;
        } else if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(post[field])) {
            return 'Le champ "email" doit être une adresse valide.';
        }

        if (field === 'name' && post[field].length > 100) {
            return 'Le champ "name" ne doit pas dépasser 100 caractères.';
        }
        if (field === 'email' && post[field].length > 100) {
            return 'Le champ "email" ne doit pas dépasser 100 caractères.';
        }
        if (field === 'body' && post[field].length > 500) {
            return 'Le champ "body" ne doit pas dépasser 500 caractères.';
        }
    }

    return null;
}

router.get('/posts', (ctx) => {
    if (ctx.query.postId === undefined) {
        ctx.body = posts;
        return;
    }

    const postId = Number(ctx.query.postId);
    if (!Number.isInteger(postId) || postId < 1) {
        ctx.status = 400;
        ctx.body = { error: 'postId must be a positive integer' };
        return;
    }

    ctx.body = posts.filter((post) => post.postId === postId);
});

router.post('/posts', (ctx) => {
    const erreur = validatePost(ctx.request.body, false);
    if (erreur) {
        ctx.status = 400;
        ctx.body = { error: erreur };
        return;
    }

    const body = ctx.request.body;
    const post = {
        postId: body.postId,
        id: nextPostId,
        name: body.name,
        email: body.email,
        body: body.body,
    };

    posts.push(post);
    nextPostId += 1;

    ctx.status = 201;
    ctx.set('Location', `/posts/${post.id}`);
    ctx.body = post;
});

router.put('/posts/:id', (ctx) => {
    const position = posts.findIndex((post) => post.id === Number(ctx.params.id));
    if (position === -1) {
        ctx.status = 404;
        ctx.body = { error: 'Post not found' };
        return;
    }

    const erreur = validatePost(ctx.request.body, false);
    if (erreur) {
        ctx.status = 400;
        ctx.body = { error: erreur };
        return;
    }

    const body = ctx.request.body;
    const post = {
        postId: body.postId,
        id: posts[position].id,
        name: body.name,
        email: body.email,
        body: body.body,
    };
    posts[position] = post;
    ctx.body = post;
});

router.patch('/posts/:id', (ctx) => {
    const post = posts.find((post) => post.id === Number(ctx.params.id));
    if (!post) {
        ctx.status = 404;
        ctx.body = { error: 'Post not found' };
        return;
    }

    const erreur = validatePost(ctx.request.body, true);
    if (erreur) {
        ctx.status = 400;
        ctx.body = { error: erreur };
        return;
    }

    Object.assign(post, ctx.request.body);
    ctx.body = post;
});

router.delete('/posts/:id', (ctx) => {
    const position = posts.findIndex((post) => post.id === Number(ctx.params.id));
    if (position === -1) {
        ctx.status = 404;
        ctx.body = { error: 'Post not found' };
        return;
    }

    posts.splice(position, 1);
    ctx.status = 204;
});

router.get('/posts/:id', (ctx) => {
    const id = parseInt(ctx.params.id);
    const post = posts.find(p => p.id === id);
    if (post) {
        ctx.body = post;
    } else {
        ctx.status = 404;
        ctx.body = { error: 'Post not found' };
    }
});


router.get('', (ctx) => {
    ctx.body = 'Hello World';
});

router.get('.health', (ctx) => {
    ctx.body = 'OK';
});


app.use(router.routes(), router.allowedMethods());
app.use((ctx) => {
  if (ctx.path === '/texte') {
    ctx.body = 'Bonjour en texte'
  } else if (ctx.path === '/posts') {
    ctx.status = 204
  //} else if (ctx.path === '/cree') {
    //ctx.status = 201
    //ctx.body = { id: 1 }
  }
})
// Bootstrap the server
app.listen(3000,()=>{
    console.log("App is Started on port: " +3000);
});