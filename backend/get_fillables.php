<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$modelsPath = app_path('Models');
$files = scandir($modelsPath);

$output = [];
foreach ($files as $file) {
    if (pathinfo($file, PATHINFO_EXTENSION) === 'php') {
        $className = 'App\\Models\\' . pathinfo($file, PATHINFO_FILENAME);
        if (class_exists($className)) {
            $model = new $className;
            $output[pathinfo($file, PATHINFO_FILENAME)] = $model->getFillable();
        }
    }
}
echo json_encode($output, JSON_PRETTY_PRINT);
