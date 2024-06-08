import { Context, Effect } from "effect";
import { parseArgs } from "util";
import { readdir } from "node:fs/promises";

class Output extends Context.Tag("Output")<
  Output,
  {
    readonly output: (values: string) => Effect.Effect<void>;
  }
>() {}

class Input extends Context.Tag("Input")<
  Input,
  { readonly input: () => Effect.Effect<string[]> }
>() {}

type Options = {
  all?: boolean;
};
type Args = {
  values: Options;
  positionals: string[];
};

const myParseArgs = (argv: string[]) =>
  Effect.try({
    try: () => {
      const { values, positionals } = parseArgs({
        args: argv,
        options: {
          all: {
            type: "boolean",
            short: "a",
          },
        },
        allowPositionals: true,
      });
      return { values, positionals } as Args;
    },
    catch: (unknown) => new Error(`parse error: ${unknown}`),
  });

type Parameters = {
  options: Options;
  target: string;
};

const decideTargetDir = (args: Args): Parameters => {
  const defaultTarget = "./";
  return {
    options: args.values,
    target: args.positionals[0] ?? defaultTarget,
  };
};

const parametersEffect = Input.pipe(
  Effect.andThen((input) => input.input()),
  Effect.flatMap(myParseArgs),
  Effect.map(decideTargetDir)
);

const readDir = (dirName: string) => Effect.tryPromise(() => readdir(dirName));
const filterHiddenFiles = (files: string[]) =>
  files.filter((file) => !file.match(/^\./));
const format = (files: string[], options: Options) => {
  const fileTexts = options.all ? files : filterHiddenFiles(files);
  return fileTexts.join(" ");
};
const outputStingEffect = parametersEffect.pipe(
  Effect.andThen((params) =>
    readDir(params.target).pipe(
      Effect.andThen((files) => format(files, params.options))
    )
  )
);

const program = Effect.all([Output, outputStingEffect]).pipe(
  Effect.andThen(([output, outputString]) => output.output(outputString))
);

const runnable = program.pipe(
  Effect.provideService(Output, {
    output: (value) => Effect.sync(() => console.log(value)),
  }),
  Effect.provideService(Input, {
    input: () => Effect.succeed(Bun.argv.slice(2))
    // input: () => Effect.succeed(["-a", "/home"]),
  })
);

Effect.runPromise(runnable).catch((error) => console.log(error));
