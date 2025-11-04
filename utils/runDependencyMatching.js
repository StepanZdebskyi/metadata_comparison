import getDependencyQuery from './getDependencyQuery.js';

async function runDependencyMatching(dependenciesMd1Collection, dependenciesMd3Collection, metadataName, refmodelMd1, refmodelMd3) {
  try {
    const dependencyProjection = {
      projection: {
        child: {
          path: 1,
        },
        parent: {
          path: 1
        },
        _id: 0          // 0 means "exclude this field"
      }
    }

    const dependcyPromiseMd1 = dependenciesMd1Collection.find(getDependencyQuery(metadataName, refmodelMd1), dependencyProjection).toArray();
    const dependcyPromiseMd3 = dependenciesMd3Collection.find(getDependencyQuery(metadataName, refmodelMd3), dependencyProjection).toArray();
    const [dependencyMd1_result, dependencyMd3_result] = await Promise.all([dependcyPromiseMd1, dependcyPromiseMd3]);

    console.log("\n--- Results for Dependency Queries (status: 'active') ---");
    console.log(`Found ${dependencyMd1_result.length} dependencies from md1 env.`);
    console.log(`Found ${dependencyMd3_result.length} dependencies from md3 env.`);

    //dependencies matching 
    const dependencyKeysMd1 = new Set(dependencyMd1_result.map(item => {
      const child = item.child?.path ?? 'null';
      const parent = item.parent?.path ?? 'null';
      return `${child}::${parent}`; // "path/A::path/B"
    }));

    const dependencyKeysMd3 = new Set(dependencyMd3_result.map(item => {
      const child = item.child?.path ?? 'null';
      const parent = item.parent?.path ?? 'null';
      return `${child}::${parent}`; // "path/A::path/B"
    }));

    const matchingDocs_Dependency = dependencyMd1_result.filter(item2 => {
      // Створіть такий самий унікальний ключ для поточного елемента
      const key = `${item2.child?.path ?? 'null'}::${item2.parent?.path ?? 'null'}`;

      // Перевірте, чи цей ключ існує в нашому Set з першого результату
      return dependencyKeysMd3.has(key);
    });

    // 4. Знаходимо унікальні для MD1 (ті, що є в md1, АЛЕ НЕМАЄ в md3)
    const dependencyMd1_Only = dependencyMd1_result.filter(item1 => {
      const key = `${item1.child?.path ?? 'null'}::${item1.parent?.path ?? 'null'}`;
      return !dependencyKeysMd3.has(key);
    });

    // 5. Знаходимо унікальні для MD3 (ті, що є в md3, АЛЕ НЕМАЄ в md1)
    const dependencyMd3_Only = dependencyMd3_result.filter(item3 => {
      const key = `${item3.child?.path ?? 'null'}::${item3.parent?.path ?? 'null'}`;
      return !dependencyKeysMd1.has(key);
    });

    console.log("--- Dependencies Comparison Complete ---");
    console.log(`Total Matches: ${matchingDocs_Dependency.length}`);
    console.log(`Found ${dependencyMd1_Only.length} dependencies that are only in md1`);
    console.log(`Found ${dependencyMd3_Only.length} dependencies that are only in md3`);
  }
  catch (err) {
    console.error("An error occured", err);
  }
}

export default runDependencyMatching;