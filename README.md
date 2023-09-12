# kysely-tidbcloud

[Kysely](https://github.com/koskimas/kysely) dialect for TiDB serverless, using the [TiDB serverless driver](https://github.com/tidbcloud/serverless-js).

It is designed to be used on the edge, like Vercel Edge Functions, Cloudflare Workers, Netlify Edge Functions, etc.

## Installation

You should also install kysely and @tidbcloud/serverless with @tidbcloud/kysely, as they are both required peer dependencies.

```
npm install kysely @tidbcloud/kysely @tidbcloud/serverless
```

## Usage

```
import { Kysely } from 'kysely'
import { TiDBServerlessDialect } from '@tidbcloud/kysely'

const db = new Kysely<Database>({
  dialect: new TiDBServerlessDialect({
    url: process.env.DATABASE_URL
  }),
})
```

Database is an interface including the database schema. See [Kysely documentation](https://kysely.dev/docs/getting-started#types) or the [full example below](#Example) for more details.

## Example

```ts
import { Kysely,GeneratedAlways,Selectable } from 'kysely'
import { TiDBServerlessDialect } from '@tidbcloud/kysely'

// Types
interface Database {
  person: PersonTable
}
interface PersonTable {
  id: GeneratedAlways<number>
  name: string
  gender: "male" | "female" | "other"
}

// Dialect
const db = new Kysely<Database>({
  dialect: new TiDBServerlessDialect({
    url: process.env.DATABASE_URL
  }),
})

// Simple Querying
type Person = Selectable<PersonTable>
export async function findPeople(criteria: Partial<Person>) {
  let query = db.selectFrom('person')

  if (criteria.name){
    query = query.where('name', '=', criteria.name)
  }

  return await query.selectAll().execute()
}

// Transaction
try{
  await db.transaction().execute(async (trx) => {
    await trx.insertInto('person')
    .values({
      name: 'test',
      gender: 'male',
    })
    .executeTakeFirstOrThrow()

    const person = await trx.selectFrom('person').where('name', '=', 'test').selectAll().execute()
    console.log(person)
    // verify the isolation of transaction
    console.log(await findPeople({'name': 'test'}))
    throw new Error("throw error to rollback");
  })
}finally {
  // verify the rollback of transaction
  console.log(await findPeople({'name': 'test'}))
}
```

## Configuration

The TiDB serverless dialect accepts the same configurations as TiDB serverless driver. For example: You can customize the `fetch` in node.js:

```ts
import { Kysely } from 'kysely'
import { TiDBServerlessDialect } from '@tidbcloud/kysely'
import { fetch } from 'undici'

const db = new Kysely<Database>({
  dialect: new TiDBServerlessDialect({
    url: process.env.DATABASE_URL,
    fetch
  }),
})
```

See [TiDB serverless driver configuration](https://github.com/tidbcloud/serverless-js#configuration) for the all configurations.
